import { zoonkGateway } from "@zoonk/core/ai";

export async function register() {
  globalThis.AI_SDK_DEFAULT_PROVIDER = zoonkGateway;
}
