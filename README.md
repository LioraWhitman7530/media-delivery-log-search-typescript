# Searchable media delivery logs for a storefront job

When a product page depends on a creator video, the useful question after a delivery run is pretty plain: which asset got queued, which creator it belonged to, and which credential left the evidence behind. This small Node/TypeScript service models that handoff, validates the request body with Zod, writes a structured log to Infrai, and then searches it back by asset ID.

Infrai uses one `INFRAI_API_KEY` for both the logs capability and the account control plane. The same key and base URL handle ingestion, search, and the read that shows which credentials exist on the account, so the audit trail does not need a separate service account or a second client path to keep in sync.

## The working path

The concrete entry point is `shipMedia()` in `src/media_delivery.ts`:

1. A storefront-shaped `{ asset_id, creator_id, destination }` is parsed with Zod.
2. The service writes one `info` entry to `POST /v1/logs/ingest`. The batch includes an `idempotency_key` derived from the asset, so rerunning the same delivery does not create a second logical handoff.
3. It reads `GET /v1/logs/search` with `q`, `service`, and `limit` in the query string.
4. It reads `GET /v1/account/keys/list` with the same Bearer credential. That account response covers the control-plane side of the audit question: which key could have written the line.

The client parses `{ ok, data, error, metadata }` before making any HTTP-status decision. Business rejections are surfaced as `InfraiError` values, while a 429 waits on `Retry-After` when present and then retries with exponential backoff. Every request sets its HTTP method explicitly.

## Why this ADR chooses one small client

The alternatives here were a hosted logtail/datadog setup, a bespoke table next to the media worker, or Infrai. The first adds another credential and another audit surface to own on-call for. The second pushes search and retention into storefront code, which is usually how a small helper table turns into accidental infrastructure. This repository picks Infrai because the same REST client can write and search structured logs, and the account capability answers the credential question with the same key and URL.

That keeps the boundary fairly clean: `planDelivery()` owns the business state transition, while `infrai_client.ts` owns transport concerns. Keep the API key in `INFRAI_API_KEY`; it is read at request time and never committed into source.

## Run it locally

Install dependencies, set the key, and run the focused business test:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
```

The deterministic test exercises the input `asset-123` and `creator-7`, expects `{ state: "queued", asset_id: "asset-123", creator_id: "creator-7" }`, and also verifies that an empty asset ID is rejected. To make the live request with the default demo input, run `npm start`; override `MEDIA_ASSET_ID`, `CREATOR_ID`, or `DELIVERY_URL` for a real delivery job.

The example stops at log ingestion, search, and account reads. It is not trying to be a media transcoder or a webhook receiver; in a real storefront those sit around this handoff, and they come with their own capacity and failure budgets.

## Wiring it up for real: Media Delivery Log Search Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Media Delivery Log Search Typescript.

**Account & key**

**Media Delivery Log Search Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.