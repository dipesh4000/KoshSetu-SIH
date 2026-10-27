"""Local-only private MinIO bucket for the containerized demo.

The endpoint is restricted by Settings to localhost or the compose service.
This adapter cannot upload to a public cloud or arbitrary external destination.
"""

from functools import lru_cache

from app.core.config import settings

BUCKET = "koshsetu-private"


@lru_cache
def client():
    import boto3
    from botocore.config import Config

    if settings.environment != "local":
        raise RuntimeError("MinIO is local-only")
    return boto3.client(
        "s3",
        endpoint_url=settings.minio_endpoint,
        region_name="us-east-1",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(
            connect_timeout=5,
            read_timeout=15,
            retries={"max_attempts": 2},
            s3={"addressing_style": "path"},
        ),
    )


def validate_key(key):
    if (
        not key
        or key.startswith("/")
        or "\\" in key
        or any(part in ("", ".", "..") for part in key.split("/"))
    ):
        raise ValueError("Invalid object key")
    return key


def put_object(key, payload, *, session=None):
    client().put_object(
        Bucket=BUCKET,
        Key=validate_key(key),
        Body=payload,
        ContentType="application/pdf",
    )
    return len(payload)


def read_object(key, *, session=None):
    from botocore.exceptions import ClientError

    try:
        response = client().get_object(Bucket=BUCKET, Key=validate_key(key))
    except ClientError as exc:
        if exc.response["Error"]["Code"] in ("NoSuchKey", "404"):
            raise FileNotFoundError(key) from exc
        raise
    body = response["Body"]
    try:
        return body.read(settings.max_upload_bytes + 1)
    finally:
        body.close()


def object_size(key, *, session=None):
    return client().head_object(Bucket=BUCKET, Key=validate_key(key))["ContentLength"]


def object_exists(key, *, session=None):
    from botocore.exceptions import ClientError

    try:
        object_size(key)
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] in ("NoSuchKey", "404", "NotFound"):
            return False
        raise


def promote(key, *, to_prefix, session=None):
    validate_key(key)
    if to_prefix not in ("clean", "rejected"):
        raise ValueError("Unsupported destination namespace")
    new_key = f"{to_prefix}/{key.split('/', 1)[1]}"
    client().copy_object(
        Bucket=BUCKET, Key=new_key, CopySource={"Bucket": BUCKET, "Key": key}
    )
    client().delete_object(Bucket=BUCKET, Key=key)
    return new_key
