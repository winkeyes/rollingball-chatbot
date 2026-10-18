"""Serve the RollingBall chat UI and proxy requests to the query API."""

import os
from pathlib import Path
from typing import Annotated, Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, StringConstraints

PROJECT_DIR = Path(__file__).resolve().parent
load_dotenv(PROJECT_DIR / ".env")
QUERY_API_URL = os.getenv("QUERY_API_URL")
if not QUERY_API_URL:
    raise RuntimeError("Set QUERY_API_URL in the environment or in a .env file.")
QUERY_API_URL = QUERY_API_URL.rstrip("/")
QUERY_API_BASE_URL = QUERY_API_URL.rsplit("/", 1)[0]
QueryText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]

app = FastAPI(title="RollingBall Chatbot", version="1.0.0")


class QueryRequest(BaseModel):
    query: QueryText


@app.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return FileResponse(PROJECT_DIR / "index.html")


@app.get("/api/health")
async def api_health() -> JSONResponse:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(f"{QUERY_API_BASE_URL}/health")
    except httpx.HTTPError:
        return JSONResponse(
            {"status": "unavailable", "endpoint": QUERY_API_URL},
            status_code=503,
        )

    if response.is_error:
        return JSONResponse(
            {"status": "unavailable", "endpoint": QUERY_API_URL},
            status_code=503,
        )
    try:
        health = response.json()
    except ValueError:
        health = {"status": "ok"}
    return JSONResponse({"status": "ok", "endpoint": QUERY_API_URL, "upstream": health})


@app.post("/api/query")
async def query(payload: QueryRequest) -> JSONResponse:
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(QUERY_API_URL, json=payload.model_dump())
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=503,
            detail="Query service is unavailable at the configured endpoint.",
        ) from error

    try:
        body: Any = response.json()
    except ValueError:
        body = {"detail": response.text or "Query service returned an empty response."}

    return JSONResponse(content=body, status_code=response.status_code)


app.mount("/assets", StaticFiles(directory=PROJECT_DIR / "assets"), name="assets")
