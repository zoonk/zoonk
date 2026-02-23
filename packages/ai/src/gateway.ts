import { createGateway } from "@ai-sdk/gateway";
import { Agent } from "undici";

const TIMEOUT_MINUTES = 15;
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1000;

export const zoonkGateway = createGateway({
  fetch: (url, init) =>
    fetch(url, {
      ...init,
      dispatcher: new Agent({
        bodyTimeout: TIMEOUT_MS,
        headersTimeout: TIMEOUT_MS,
      }),
    } as RequestInit),
  headers: {
    "http-referer": "https://www.zoonk.com",
    "x-title": "Zoonk",
  },
});
