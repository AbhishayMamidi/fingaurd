const amqp = require('amqplib');
const config = require('./config');
const db = require('./db');
const { budgetEventsProcessedTotal, budgetAlertsTriggeredTotal } = require('./metrics');

class BudgetEventConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  async start() {
    const user = encodeURIComponent(config.rabbitmq.user);
    const pass = encodeURIComponent(config.rabbitmq.password);
    const url = config.rabbitmq.url || `amqp://${user}:${pass}@${config.rabbitmq.host}:${config.rabbitmq.port}`;
    const retries = 15;
    const delayMs = 4000;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[budget-consumer] Connecting to RabbitMQ (Attempt ${attempt}/${retries})...`);
        this.connection = await amqp.connect(url);
        this.channel = await this.connection.createChannel();

        this.connection.on('error', (err) => {
          console.error('[budget-consumer] RabbitMQ connection error:', err.message);
          this.isConnected = false;
        });

        this.connection.on('close', () => {
          console.warn('[budget-consumer] RabbitMQ connection closed. Reconnecting in 5s...');
          this.isConnected = false;
          setTimeout(() => this.start(), 5000);
        });

        const exchange = 'finguard.events';
        const dlx = 'finguard.dlx';
        const queue = 'q.budget_evaluation';

        await this.channel.assertExchange(exchange, 'topic', { durable: true });
        await this.channel.assertExchange(dlx, 'direct', { durable: true });

        await this.channel.assertQueue(queue, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': dlx,
            'x-dead-letter-routing-key': 'dlx.budget',
          },
        });

        // Bind to all transaction events
        await this.channel.bindQueue(queue, exchange, 'transaction.*');
        await this.channel.prefetch(1);

        console.log(`[budget-consumer] Listening for events on '${queue}'...`);
        this.isConnected = true;

        this.channel.consume(queue, async (msg) => {
          if (!msg) return;
          try {
            await this.processMessage(msg);
            this.channel.ack(msg);
          } catch (err) {
            console.error('[budget-consumer] Error processing message:', err.message);
            // Nack without requeue sends to Dead Letter Exchange
            this.channel.nack(msg, false, false);
          }
        });

        return;
      } catch (err) {
        console.warn(`[budget-consumer] Connection attempt ${attempt} failed: ${err.message}`);
        if (attempt === retries) {
          console.error('[budget-consumer] Could not connect to RabbitMQ. Will retry in background.');
          setTimeout(() => this.start(), 10000);
          return;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  async processMessage(msg) {
    const rawContent = msg.content.toString();
    const event = JSON.parse(rawContent);
    const { event_id, event_type, user_id, amount, category, merchant, is_fraud_flagged, fraud_reason, date } = event;

    if (!event_id || !user_id) {
      console.warn('[budget-consumer] Missing event_id or user_id; skipping.');
      return;
    }

    // 1. Idempotency Check
    const existing = await db.query('SELECT event_id FROM processed_events WHERE event_id = $1', [event_id]);
    if (existing.rows.length > 0) {
      console.log(`[budget-consumer] Duplicate event ${event_id} already processed. Skipping.`);
      return;
    }

    // 2. Mark event as processed
    await db.query(
      'INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [event_id, event_type || 'TRANSACTION_EVENT']
    );

    // 3. Fraud Alert Generation
    if (is_fraud_flagged) {
      const alertTitle = `Fraud Alert: Suspicious Transaction Flagged`;
      const alertMessage = `Transaction at '${merchant || 'Unknown Merchant'}' for $${Number(amount).toFixed(2)} was flagged by anomaly detection. Reasons: ${fraud_reason || 'Deviates from baseline spending patterns'}.`;

      await db.query(
        `INSERT INTO alerts (user_id, type, title, message, category, current_spent, budget_limit)
         VALUES ($1, 'FRAUD_ALERT', $2, $3, $4, $5, $6)`,
        [user_id, alertTitle, alertMessage, category || 'Other', Number(amount) || 0, 0]
      );
      budgetAlertsTriggeredTotal.inc({ alert_type: 'FRAUD_ALERT', category: category || 'Other' });
      console.log(`[budget-consumer] Created FRAUD_ALERT for user=${user_id}`);
    }

    // 4. Budget Evaluation
    if (category && event_type === 'TRANSACTION_CREATED') {
      const txDate = date ? new Date(date) : new Date();
      const monthYear = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

      // Find user budget for this category and month
      const budgetRes = await db.query(
        'SELECT * FROM budgets WHERE user_id = $1 AND category = $2 AND month_year = $3',
        [user_id, category, monthYear]
      );

      if (budgetRes.rows.length > 0) {
        const budget = budgetRes.rows[0];
        const monthlyLimit = Number(budget.monthly_limit);

        // Fetch or estimate total spending for this category this month
        // We calculate current spent by querying transaction-service or accumulating in alerts
        // Let's trigger alert if spending passes threshold
        // We can check past alerts for this category this month to avoid alert fatigue
        const warningThreshold = monthlyLimit * 0.8;

        // Query transactions total from transaction service
        let totalSpent = Number(amount);
        try {
          const fetchRes = await fetch(
            `${config.transactionServiceUrl}/api/transactions/summary?month=${monthYear}`,
            {
              headers: {
                // Internal service call or pass user query
                'X-Internal-Service': 'budget-service',
              },
            }
          ).catch(() => null);

          if (fetchRes && fetchRes.ok) {
            const sumData = await fetchRes.json();
            const catItem = (sumData.category_breakdown || []).find((c) => c.category === category);
            if (catItem) {
              totalSpent = Number(catItem.total);
            }
          }
        } catch {
          // Fallback to current transaction amount
        }

        if (totalSpent >= monthlyLimit) {
          await db.query(
            `INSERT INTO alerts (user_id, type, title, message, category, current_spent, budget_limit)
             VALUES ($1, 'BUDGET_EXCEEDED', $2, $3, $4, $5, $6)`,
            [
              user_id,
              `Budget Exceeded: ${category}`,
              `You have exceeded your ${category} budget of $${monthlyLimit.toFixed(2)} (Spent: $${totalSpent.toFixed(2)}).`,
              category,
              totalSpent,
              monthlyLimit,
            ]
          );
          budgetAlertsTriggeredTotal.inc({ alert_type: 'BUDGET_EXCEEDED', category });
          console.log(`[budget-consumer] BUDGET_EXCEEDED alert created for user=${user_id}, category=${category}`);
        } else if (totalSpent >= warningThreshold) {
          // Check if already sent warning this month
          const priorWarning = await db.query(
            `SELECT id FROM alerts WHERE user_id = $1 AND category = $2 AND type = 'BUDGET_WARNING' AND created_at >= date_trunc('month', CURRENT_DATE)`,
            [user_id, category]
          );
          if (priorWarning.rows.length === 0) {
            await db.query(
              `INSERT INTO alerts (user_id, type, title, message, category, current_spent, budget_limit)
               VALUES ($1, 'BUDGET_WARNING', $2, $3, $4, $5, $6)`,
              [
                user_id,
                `Budget Warning (80%): ${category}`,
                `You have spent $${totalSpent.toFixed(2)} of your $${monthlyLimit.toFixed(2)} monthly budget (80%+ threshold reached).`,
                category,
                totalSpent,
                monthlyLimit,
              ]
            );
            budgetAlertsTriggeredTotal.inc({ alert_type: 'BUDGET_WARNING', category });
            console.log(`[budget-consumer] BUDGET_WARNING alert created for user=${user_id}, category=${category}`);
          }
        }
      }
    }
    budgetEventsProcessedTotal.inc({ status: 'success', event_type: event_type || 'UNKNOWN' });
  }
}

const budgetConsumer = new BudgetEventConsumer();
module.exports = budgetConsumer;
