# RollingBall Chatbot

A responsive chatbot with the RollingBall visual style. The browser talks to this app's same-origin `/api/query` proxy, which forwards requests to the query API configured by `QUERY_API_URL`. The proxy avoids browser CORS restrictions.

## Run

Set `QUERY_API_URL` in `.env` to the query endpoint (for example, `http://localhost:8081/query`). Copy `.env.example` to `.env` and adjust it for your environment. Start the query API first, then run from this project directory:

```powershell
Copy-Item .env.example .env
# Edit .env and set QUERY_API_URL to your query service endpoint.
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8002 --reload
```

Open `http://127.0.0.1:8002`. Environment variables take precedence over `.env`. The API status indicator checks the upstream `/health` endpoint; requests and actual upstream errors are shown in the conversation.

## Run with Docker

Build the image from this directory:

```powershell
docker build -t rollingball-chatbot .
```

Pass the `.env` file at runtime. Inside a container, `localhost` means the container itself, so override the endpoint with `host.docker.internal` when the query API runs on the Docker host:

```powershell
docker run --rm -p 8002:8002 --env-file .env -e QUERY_API_URL=http://host.docker.internal:8081/query rollingball-chatbot
```

Open `http://localhost:8002`. If the query API is another container, set `QUERY_API_URL` to that container's service name and port instead.

## Request contract

The query API expects:

```json
{"query":"When is the next bus to downtown after 09:00?"}
```

It responds with an `answer` string and a `tool_calls` list. The chat UI displays both, without generating local fallback answers.

## Test

```powershell
pip install -r requirements-dev.txt
python -m pytest -q
```
