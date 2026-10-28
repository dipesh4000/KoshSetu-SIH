# Firebase notifications architecture (future integration)

Firebase Cloud Messaging (FCM) is intentionally **not enabled** in this
repository. Notifications remain in-app through the local queue/outbox until
an institution approves a Firebase project and data policy.

## Proposed flow

1. The scheduler creates a redacted notification row with event type, user id,
   and expiry. It must not include a full FDR number, document URL, principal,
   bank response, or credentials.
2. A worker claims queued rows with a database lock and resolves active device
   tokens for users assigned to the notification's institution.
3. The private backend worker calls FCM using the Firebase Admin SDK. The
   browser never receives an Admin credential.
4. Delivery is recorded as `sent`, `failed`, or `expired` with bounded error
   codes. Retries use exponential backoff and an idempotency key; unregistered
   tokens are removed.
5. The UI remains the source of truth. Push messages are hints to open an
   authenticated in-app notification, never public document links.

## Configuration contract

After approval, provide `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY`, and the public web `FIREBASE_VAPID_KEY` through the
deployment secret manager, never source control or chat. The recipient scope
is active users assigned to the notification's institution.

## Approval and test checklist

- Record the project owner, region, retention period, and recipient policy.
- Use separate Firebase projects for local, staging, and production.
- Add a fake FCM adapter in tests; never call FCM from CI.
- Verify token registration/revocation, duplicate delivery, retry limits,
  audit redaction, and institution-scope enforcement.
- Enable only behind `NOTIFICATIONS_FCM_ENABLED=true` after security/privacy
  approval; leave it false otherwise.
