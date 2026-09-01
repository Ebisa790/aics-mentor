from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    \"\"\"Test the health check endpoint.\"\"\"
    response = client.get(\"/api/health\")
    assert response.status_code == 200
    assert response.json() == {\"status\": \"ok\"}


def test_support_ticket_anonymous():
    \"\"\"Test that anonymous users can submit support tickets.\"\"\"
    response = client.post(
        \"/api/support/tickets\",
        json={
            \"subject\": \"Test Ticket\",
            \"message\": \"This is a test message for support ticket\",
            \"issue_type\": \"other\",
            \"email\": \"test@example.com\"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert \"ticket_id\" in data
    assert data[\"status\"] == \"open\"


def test_support_ticket_missing_email():
    \"\"\"Test that email is required for anonymous users.\"\"\"
    response = client.post(
        \"/api/support/tickets\",
        json={
            \"subject\": \"Test Ticket\",
            \"message\": \"This is a test message\",
            \"issue_type\": \"other\"
        }
    )
    assert response.status_code == 400
    assert \"Email is required\" in response.json()[\"detail\"]


def test_support_ticket_missing_subject():
    \"\"\"Test that subject is required.\"\"\"
    response = client.post(
        \"/api/support/tickets\",
        json={
            \"message\": \"This is a test message\",
            \"issue_type\": \"other\",
            \"email\": \"test@example.com\"
        }
    )
    assert response.status_code == 400
    assert \"Subject\" in response.json()[\"detail\"]
