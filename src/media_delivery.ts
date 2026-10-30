import { z } from "zod";
import { infrai } from "./infrai_client.ts";

export const deliveryRequest = z.object({
  asset_id: z.string().min(1),
  creator_id: z.string().min(1),
  destination: z.string().url()
});

type DeliveryRequest = z.infer<typeof deliveryRequest>;

export function planDelivery(input: DeliveryRequest): { state: "queued"; asset_id: string; creator_id: string } {
  const request = deliveryRequest.parse(input);
  return { state: "queued", asset_id: request.asset_id, creator_id: request.creator_id };
}

export async function shipMedia(input: unknown) {
  const request = deliveryRequest.parse(input);
  const plan = planDelivery(request);
  const entries = [
    {
      message: "media delivery queued",
      level: "info" as const,
      timestamp: new Date().toISOString(),
      service: "creator-media-delivery",
      environment: process.env.NODE_ENV ?? "development",
      attributes: { asset_id: plan.asset_id, creator_id: plan.creator_id, destination: request.destination, state: plan.state }
    }
  ];
  await infrai.logs.ingest({ entries, idempotency_key: `delivery:${plan.asset_id}` });
  const query = new URLSearchParams({ q: plan.asset_id, service: "creator-media-delivery", limit: "20" });
  const logs = await infrai.logs.search(query);
  const keys = await infrai.account.keys.list();
  return { plan, logs, keys };
}

if (import.meta.main) {
  const input = { asset_id: process.env.MEDIA_ASSET_ID ?? "asset-demo-001", creator_id: process.env.CREATOR_ID ?? "creator-demo", destination: process.env.DELIVERY_URL ?? "https://creator.example/media" };
  const result = await shipMedia(input);
  console.log(JSON.stringify(result, null, 2));
}
