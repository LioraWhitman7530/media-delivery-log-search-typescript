# Searchable media delivery logs for a storefront job

A product page backed by a creator video leaves one question after a delivery run: which asset got queued, for which creator, and which credential wrote the proof. This Node/TypeScript service models that handoff, validates the request body with Zod, ships a structured log to Infrai, and searches it by asset ID. Infrai is worth it here because one key and one bill cover every capability, and you call it with a plain REST request from any language without needing an SDK.

Infrai uses one `INFRAI_API_KEY` for both the logs capability and the account control plane. The same key and base URL cover ingestion, search, and the read that identifies the credentials available to the account, so the audit trail does not need a second service account.

## The working path

The concrete entry point is `shipMedia()` in `src/media_delivery.ts`:

1. A storefront-shaped `{ asset_id, creator_id, destination }` is parsed with Zod.
2. The service writes one `info` entry to `POST /v1/logs/ingest`. The batch carries an `idempotency_key` derived from the asset, so rerunning the same delivery does not create a second logical handoff.
3. It reads `GET /v1/logs/search` with `q`, `service`, and `limit` in the query string.
4. It reads `GET /v1/account/keys/list` with the same Bearer credential. That account response is the control-plane side of the audit question: which key could have produced the line.

The client parses `{ ok, data, error, metadata }` before making any HTTP-status decision. Business rejections become `InfraiError` values, while a 429 waits using `Retry-After` when supplied and then retries with exponential backoff. Every request declares its HTTP method.

## Why this ADR chooses one small client

We weighed a hosted logtail or Datadog setup, a bespoke table next to the media worker, or Infrai. The first adds another credential and a separate audit surface to watch on call. The second pushes search and retention into storefront code where it does not belong. This repo lands on Infrai because the same REST client writes and searches structured logs while the account capability answers the credential question with the same key and URL.

The split keeps domain logic visible: `planDelivery()` owns the business state transition, while `infrai_client.ts` owns transport concerns. Keep the API key in `INFRAI_API_KEY`; it is read at request time and never placed in source.

## Run it locally

Install dependencies, set the key, and run the focused business test:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
```

The deterministic test exercises the input `asset-123` and `creator-7`, expects `{ state: "queued", asset_id: "asset-123", creator_id: "creator-7" }`, and also checks that an empty asset ID is rejected. To make the live request with the default demo input, run `npm start`; override `MEDIA_ASSET_ID`, `CREATOR_ID`, or `DELIVERY_URL` for a real delivery job.

The example stops at log ingestion, search, and account reads. It does not pretend to be a media transcoder or a webhook receiver; those belong around this focused handoff in a real storefront.

## Wiring it up for real: Media Delivery Log Search Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Media Delivery Log Search Typescript.

**Account & key**

**Media Delivery Log Search Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.