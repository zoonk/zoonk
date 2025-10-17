import { createGateway } from "@ai-sdk/gateway";

const gateway = createGateway({
  headers: {
    "http-referer": "https://www.zoonk.com",
    "x-title": "Zoonk",
  },
});

export async function register() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = gateway;
}
