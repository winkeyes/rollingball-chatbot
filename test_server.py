import pytest
from fastapi.testclient import TestClient

import server


@pytest.fixture

def client():
    with TestClient(server.app) as test_client:
        yield test_client


def test_serves_chat_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "RollingBall Chatbot" in response.text


def test_query_forwards_query_and_returns_api_answer(client, monkeypatch):
    request_data = {}
    api_response = {
        "answer": "The next bus is at 09:15.",
        "tool_calls": [{"name": "get_next_bus", "result": {"next_bus": "09:15"}}],
    }

    class FakeResponse:
        status_code = 200

        def json(self):
            return api_response

    class FakeClient:
        def __init__(self, timeout):
            request_data["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, url, *, json):
            request_data["url"] = url
            request_data["json"] = json
            return FakeResponse()

    monkeypatch.setattr(server.httpx, "AsyncClient", FakeClient)
    response = client.post("/api/query", json={"query": "Next bus downtown?"})

    assert response.status_code == 200
    assert response.json() == api_response
    assert request_data["url"] == server.QUERY_API_URL
    assert request_data["json"] == {"query": "Next bus downtown?"}
    assert request_data["timeout"] == 120


def test_query_reports_unavailable_backend(client, monkeypatch):
    class FakeClient:
        def __init__(self, timeout):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, *_args, **_kwargs):
            raise server.httpx.ConnectError("offline")

    monkeypatch.setattr(server.httpx, "AsyncClient", FakeClient)
    response = client.post("/api/query", json={"query": "Hello"})

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"]
