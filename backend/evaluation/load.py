"""Bounded local read load test. Never points at an arbitrary remote service.

Run against the local synthetic server: python -m evaluation.load --requests 100 --concurrency 5
Use --seed 10000 to add synthetic draft rows to an explicitly named disposable database.
"""

import argparse
import json
import os
import platform
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import httpx


def seed_load(count):
    if not os.environ.get("KOSHSETU_LOAD_DATABASE_URL"):
        raise SystemExit(
            "Set KOSHSETU_LOAD_DATABASE_URL to a disposable local database before seeding"
        )
    os.environ["KOSHSETU_DATABASE_URL"] = os.environ["KOSHSETU_LOAD_DATABASE_URL"]
    from app.seed import seed
    from app.db.session import SessionFactory
    from app.db.models import Fdr, Institution, User
    from app.core.security import obfuscate_store, lookup_hash, mask_fdr_number
    from sqlalchemy import select
    from datetime import date, timedelta

    seed(reset=False)
    with SessionFactory() as db:
        institution = db.scalar(select(Institution).limit(1))
        user = db.scalar(select(User).where(User.email == "submitter@coastal.demo"))
        for index in range(count):
            reference = "LOAD/" + uuid4().hex
            db.add(
                Fdr(
                    id=str(uuid4()),
                    institution_id=institution.id,
                    created_by=user.id,
                    issuer_bank="Synthetic Load Bank",
                    fdr_number_ciphertext=obfuscate_store(reference),
                    fdr_number_masked=mask_fdr_number(reference),
                    fdr_lookup_hash=lookup_hash("Synthetic Load Bank", reference),
                    principal_amount="100000.00",
                    issue_date=date(2024, 1, 1),
                    maturity_date=date.today() + timedelta(days=index % 365),
                )
            )
        db.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--requests", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if (
        not 1 <= args.requests <= 10000
        or not 1 <= args.concurrency <= 50
        or not 0 <= args.seed <= 10000
    ):
        raise SystemExit(
            "Limits: 1–10000 requests, 1–50 concurrent readers, 0–10000 seeded instruments"
        )
    if args.seed:
        seed_load(args.seed)
        print(
            "Seeded synthetic load records. Restart the local server against this database before measuring."
        )
        return
    base = f"http://127.0.0.1:{args.port}/api/v1"
    with httpx.Client(base_url=base, timeout=60) as auth:
        response = auth.post(
            "/auth/login",
            json={"email": "scrutiny@aicte.demo", "password": "Demo@12345"},
        )
        response.raise_for_status()
        token = auth.cookies.get("koshsetu_session")

    def read(index):
        path = ("/fdrs?limit=50", "/overview", "/maturities?band=90")[index % 3]
        start = time.perf_counter()
        with httpx.Client(
            base_url=base, headers={"Authorization": f"Bearer {token}"}, timeout=60
        ) as client:
            response = client.get(path)
        return {
            "path": path,
            "ms": 1000 * (time.perf_counter() - start),
            "status": response.status_code,
        }

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(read, range(args.requests)))
    values = sorted(result["ms"] for result in results)
    report = {
        "hardware": platform.platform(),
        "python": platform.python_version(),
        "requests": args.requests,
        "concurrency": args.concurrency,
        "endpoint": base,
        "errors": sum(row["status"] != 200 for row in results),
        "method": "Local HTTP reads including client connection setup; not a production capacity claim",
        "percentiles_ms": {
            f"p{percentile}": round(
                values[min(len(values) - 1, int(len(values) * percentile / 100))], 2
            )
            for percentile in (50, 95, 99)
        },
        "results": results,
    }
    Path(__file__).with_name("latency.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({key: value for key, value in report.items() if key != "results"}))


if __name__ == "__main__":
    main()
