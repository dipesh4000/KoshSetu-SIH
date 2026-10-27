"""Explicit, non-destructive upgrades for existing local prototype records."""

from sqlalchemy import select
from app.core.security import deobfuscate_store, obfuscate_store
from app.core.config import settings
from app.db.models import Fdr
from app.db.session import SessionFactory


def encrypt_legacy_identifiers():
    with SessionFactory() as db:
        count = 0
        for record in db.scalars(select(Fdr)):
            if not record.fdr_number_ciphertext.startswith(
                f"v2:{settings.encryption_key_id}:"
            ):
                record.fdr_number_ciphertext = obfuscate_store(
                    deobfuscate_store(record.fdr_number_ciphertext)
                )
                count += 1
        db.commit()
        return count


if __name__ == "__main__":
    print({"identifiers_upgraded": encrypt_legacy_identifiers()})
