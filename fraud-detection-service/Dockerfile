FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install build essentials if needed for scikit-learn/numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    rm -rf /usr/local/lib/python3.11/site-packages/setuptools* \
           /usr/local/lib/python3.11/site-packages/wheel* \
           /usr/local/lib/python3.11/site-packages/pip* \
           /usr/local/bin/pip* \
           /usr/local/bin/wheel*

COPY app/ ./app/
COPY tests/ ./tests/

EXPOSE 5004

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request, os; p = os.getenv('PORT', os.getenv('FRAUD_PORT', '5004')); urllib.request.urlopen(f'http://localhost:{p}/health')" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-5004}"]
