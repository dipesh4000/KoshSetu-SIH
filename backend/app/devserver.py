"""Container entrypoint for the synthetic local demo only."""

from alembic import command
from alembic.config import Config
import uvicorn

from app.core.config import settings
from app.seed import seed

if __name__ == "__main__":
    if settings.environment != "local":
        raise RuntimeError(
            "Use a reviewed deployment entrypoint outside local development"
        )
    command.upgrade(Config("alembic.ini"), "head")
    seed(reset=False)
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)
