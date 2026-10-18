FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --shell /usr/sbin/nologin appuser

COPY --chown=appuser:appuser server.py index.html ./
COPY --chown=appuser:appuser assets ./assets

USER appuser

EXPOSE 8002

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8002"]
