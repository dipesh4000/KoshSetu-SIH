"""Test fixtures: a disposable database seeded with the synthetic dataset."""

from __future__ import annotations

import os
import shutil
import tempfile
from collections.abc import Iterator

import pytest

_TEMP_ROOT = tempfile.mkdtemp(prefix="koshsetu-tests-")
os.environ["KOSHSETU_ENVIRONMENT"] = "local"
os.environ["KOSHSETU_DATABASE_URL"] = f"sqlite:///{_TEMP_ROOT}/test.db"
os.environ["KOSHSETU_STORAGE_ROOT"] = f"{_TEMP_ROOT}/objects"
os.environ["KOSHSETU_JWT_SECRET"] = "test-secret-not-for-deployment"
os.environ["KOSHSETU_FDR_HMAC_KEY"] = "test-hmac-not-for-deployment"
os.environ["KOSHSETU_MOCK_BANK_ENABLED"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from app.db.session import SessionFactory  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import DEMO_PASSWORD, seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded_database() -> Iterator[None]:
    seed(reset=True)
    yield
    shutil.rmtree(_TEMP_ROOT, ignore_errors=True)


@pytest.fixture
def db():
    session = SessionFactory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Iterator[TestClient]:
    """An anonymous client with its own cookie jar."""
    with TestClient(app) as test_client:
        yield test_client


def sign_in(client: TestClient, email: str) -> TestClient:
    """Attach the session and CSRF cookies for `email` to this client."""
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200, response.text
    client.headers.update({"X-CSRF-Token": client.cookies.get("koshsetu_csrf")})
    return client


@pytest.fixture
def as_user() -> Iterator[object]:
    """Build independent signed-in clients.

    Each role gets its own cookie jar, so one test can act as an institution
    and an officer without either session overwriting the other.
    """
    opened: list[TestClient] = []

    def factory(email: str) -> TestClient:
        test_client = TestClient(app)
        test_client.__enter__()
        opened.append(test_client)
        return sign_in(test_client, email)

    yield factory
    for test_client in opened:
        test_client.__exit__(None, None, None)


@pytest.fixture
def institution_client(as_user) -> TestClient:
    return as_user("submitter@coastal.demo")


@pytest.fixture
def other_institution_client(as_user) -> TestClient:
    return as_user("submitter@highland.demo")


@pytest.fixture
def officer_client(as_user) -> TestClient:
    return as_user("scrutiny@aicte.demo")


@pytest.fixture
def supervisor_client(as_user) -> TestClient:
    return as_user("supervisor@aicte.demo")
