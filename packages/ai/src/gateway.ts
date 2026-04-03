import { createGateway } from "@ai-sdk/gateway";

export const zoonkGateway = createGateway({
  headers: {
    "http-referer": "https://www.zoonk.com",
    "x-title": "Zoonk",
  },
});
