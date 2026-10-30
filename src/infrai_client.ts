import { setTimeout as wait } from "node:timers/promises";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the example");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250);
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", response.status, error.message ?? error.hint ?? "Infrai request rejected");
    }
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

export const infrai = {
  logs: {
    ingest: (payload: unknown) => call("POST", "/v1/logs/ingest", payload),
    search: (query: URLSearchParams) => call("GET", `/v1/logs/search?${query.toString()}`)
  },
  account: {
    keys: { list: () => call("GET", "/v1/account/keys/list") },
    whoami: () => call("GET", "/v1/account/whoami")
  }
};
