"""Release checklist policy loading and instantiation.

Clearances are instantiated from the policy version in force when the case is
created, so editing the catalogue later cannot retroactively change an open
case.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

POLICY_PATH = Path(__file__).with_name("policy.yaml")


@dataclass(frozen=True)
class ReleasePolicy:
    name: str
    version: str
    sha256: str
    effective_from: date
    bases: dict[str, dict[str, Any]]
    bureaus: dict[str, dict[str, str]]
    documents: dict[str, str]

    def basis(self, basis_code: str) -> dict[str, Any]:
        if basis_code not in self.bases:
            raise KeyError(basis_code)
        return self.bases[basis_code]

    def bureau_name(self, code: str) -> str:
        return self.bureaus.get(code, {}).get("name", code)


@lru_cache
def load_policy() -> ReleasePolicy:
    raw = POLICY_PATH.read_bytes()
    parsed = yaml.safe_load(raw)
    effective = parsed["effective_from"]
    return ReleasePolicy(
        name=parsed["checklist_name"],
        version=str(parsed["version"]),
        sha256=hashlib.sha256(raw).hexdigest(),
        effective_from=effective if isinstance(effective, date) else date.fromisoformat(effective),
        bases=parsed["bases"],
        bureaus=parsed["bureaus"],
        documents=parsed["documents"],
    )


def available_bases() -> list[dict[str, Any]]:
    policy = load_policy()
    return [
        {
            "code": code,
            "label": spec["label"],
            "required_documents": [
                {"code": doc, "label": policy.documents.get(doc, doc)}
                for doc in spec["required_documents"]
            ],
            "clearances": [
                {"code": bureau, "name": policy.bureau_name(bureau)}
                for bureau in spec["clearances"]
            ],
        }
        for code, spec in policy.bases.items()
    ]
