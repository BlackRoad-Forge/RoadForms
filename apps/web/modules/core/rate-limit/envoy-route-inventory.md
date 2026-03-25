# Envoy Rate-Limit POC Route Inventory

This document maps the current Redis-backed rate-limit surface to the Envoy Gateway staging POC for `formbricks/internal#1483`.

## Gateway-managed in the POC

### IP-keyed public traffic

- `auth.login`
  - App config: `rateLimitConfigs.auth.login`
  - App behavior: `10 / 15 minutes`
  - Gateway POC: `POST /api/auth/callback/credentials`
  - Gateway note: approximated as `40 / hour` because Envoy Gateway global rate limits only support whole-unit windows.

- `auth.verifyEmail`
  - App config: `rateLimitConfigs.auth.verifyEmail`
  - App behavior: `10 / hour`
  - Gateway POC: `POST /api/auth/callback/token`

- `api.client`
  - App config: `rateLimitConfigs.api.client`
  - App behavior: `100 / minute`
  - Gateway POC:
    - `^/api/v1/client/[^/]+/(environment|responses(?:/[^/]+)?|displays|user)$`
    - `^/api/v2/client/[^/]+/responses(?:/[^/]+)?$`
    - `^/api/v2/client/[^/]+/displays$`

- `storage.upload`
  - App config: `rateLimitConfigs.storage.upload`
  - App behavior: `5 / minute`
  - Gateway POC:
    - `POST ^/api/v1/client/[^/]+/storage$`
    - `POST ^/api/v2/client/[^/]+/storage$`

### Header-keyed API traffic

- `api.v1`
  - App config: `rateLimitConfigs.api.v1`
  - App behavior: `100 / minute`
  - Gateway POC:
    - `^/api/v1/management/` when `x-api-key` is present
    - `^/api/v1/webhooks/` when `x-api-key` is present

- `storage.upload`
  - App config: `rateLimitConfigs.storage.upload`
  - App behavior: `5 / minute`
  - Gateway POC:
    - `POST /api/v1/management/storage` when `x-api-key` is present

- `storage.delete`
  - App config: `rateLimitConfigs.storage.delete`
  - App behavior: `5 / minute`
  - Gateway POC:
    - `DELETE ^/storage/[^/]+/(public|private)/.+$` when `x-api-key` is present

## Left in the app on purpose

- `rateLimitConfigs.auth.signup`
- `rateLimitConfigs.auth.forgotPassword`
- profile email update actions
- follow-up dispatch
- link survey email sending
- license recheck
- user/session/org keyed authenticated flows
- all runtime logic in:
  - `apps/web/app/lib/api/with-api-logging.ts`
  - `apps/web/modules/auth/lib/authOptions.ts`
  - `apps/web/modules/core/rate-limit/rate-limit-configs.ts`

## Negative controls

- `/api/v1/client/og` must stay unthrottled at the gateway layer.
- `/api/v2/health` stays outside the gateway path for the staging POC.
- `OPTIONS` stays unthrottled because Envoy policy rules only match the explicitly listed methods.

## How to interpret failures

- Gateway `429`
  - look for `x-envoy-ratelimited`
  - body will not use the Formbricks `code: "too_many_requests"` JSON shape

- App `429`
  - V1 responses use `apps/web/app/lib/api/response.ts`
  - V2 responses use `apps/web/modules/api/v2/lib/response.ts`
  - V3 responses use `apps/web/app/api/v3/lib/response.ts`
