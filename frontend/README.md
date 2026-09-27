# FinGuard Frontend

The **FinGuard Frontend** is a responsive single-page fintech application built with **React**, **Vite**, and clean **plain CSS**. It features live financial dashboards, interactive SVG donut charts, monthly budget tracking progress bars, and high-visibility anomaly/fraud detection indicators.

## Architecture & Tech Stack
- **Framework:** React 18 + Vite 5
- **Styling:** Custom plain CSS with dark fintech theme, responsive grids, and design tokens
- **Data Visualization:** Lightweight, zero-dependency pure SVG chart components
- **State Management:** Reactive component hooks with centralized API client

## Key Capabilities
1. **User Authentication:** Registration and login modal with JWT token management and automatic session persistence.
2. **Interactive Financial Dashboard:**
   - Real-time summaries: Total Income, Total Expenses, Net Cash Flow, and Flagged Anomaly Count.
   - Category-wise spending breakdown with responsive donut chart and legends.
   - Monthly category budget status bars.
3. **Transaction Management:**
   - Add, edit, and delete transactions.
   - Live filtering by search query, category, type (income vs. expense), and anomaly status.
4. **Budget & Alert Center:**
   - Set monthly allowances per category.
   - Real-time 80% warning and 100% exceeded budget threshold indicators.
5. **Fraud & Anomaly Hub:**
   - Visual risk score meter (0-100%).
   - Diagnostic anomaly explanation cards.
   - Clearly stated experimental model disclaimer.
6. **Synthetic Demo Seeder:**
   - One-click synthetic demo generator populated with realistic transactions, paychecks, recurring bills, and clearly labeled anomaly testing items.

## Running Locally

```bash
# Install dependencies
npm install

# Run Vite dev server
npm run dev

# Build production bundle
npm run build
```
