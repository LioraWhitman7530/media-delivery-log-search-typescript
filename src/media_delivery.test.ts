import test from "node:test";
import assert from "node:assert/strict";
import { planDelivery } from "./media_delivery.ts";

test("a storefront media handoff keeps the asset and creator together", () => {
  assert.deepEqual(planDelivery({ asset_id: "asset-123", creator_id: "creator-7", destination: "https://creator.example/inbox" }), {
    state: "queued",
    asset_id: "asset-123",
    creator_id: "creator-7"
  });
  assert.throws(() => planDelivery({ asset_id: "", creator_id: "creator-7", destination: "https://creator.example/inbox" }));
});
