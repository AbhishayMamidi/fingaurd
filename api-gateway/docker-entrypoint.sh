#!/bin/sh
set -e

# If Render or cloud environment sets dynamic PORT, update Nginx listen directives
if [ -n "$PORT" ] && [ "$PORT" != "80" ]; then
    echo "[api-gateway] Configuring Nginx to listen on dynamic PORT ${PORT}..."
    sed -i "s/listen 80;/listen ${PORT};/g" /etc/nginx/nginx.conf
    sed -i "s/listen \[::\]:80;/listen [::]:${PORT};/g" /etc/nginx/nginx.conf
fi

# Allow optional override of upstream hosts for cloud environments
[ -n "$AUTH_SERVICE_HOST" ] && sed -i "s/server auth-service:5001;/server ${AUTH_SERVICE_HOST}:5001;/g" /etc/nginx/nginx.conf
[ -n "$TRANSACTION_SERVICE_HOST" ] && sed -i "s/server transaction-service:5002;/server ${TRANSACTION_SERVICE_HOST}:5002;/g" /etc/nginx/nginx.conf
[ -n "$CATEGORIZATION_SERVICE_HOST" ] && sed -i "s/server categorization-service:5003;/server ${CATEGORIZATION_SERVICE_HOST}:5003;/g" /etc/nginx/nginx.conf
[ -n "$FRAUD_SERVICE_HOST" ] && sed -i "s/server fraud-detection-service:5004;/server ${FRAUD_SERVICE_HOST}:5004;/g" /etc/nginx/nginx.conf
[ -n "$BUDGET_SERVICE_HOST" ] && sed -i "s/server budget-alert-service:5005;/server ${BUDGET_SERVICE_HOST}:5005;/g" /etc/nginx/nginx.conf
[ -n "$FRONTEND_HOST" ] && sed -i "s/server frontend:80;/server ${FRONTEND_HOST}:80;/g" /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
