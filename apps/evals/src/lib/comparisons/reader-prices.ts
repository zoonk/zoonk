import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { GATEWAY_PRICES } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices, refreshGatewayPrices } from "@zoonk/ai/pricing/gateway-prices";

let refreshed: Promise<GatewayPrices> | undefined;

async function refresh() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "eval-prices-"));

  try {
    return await refreshGatewayPrices(pathToFileURL(path.join(temporary, "prices.json")));
  } finally {
    await fs.rm(temporary, { force: true, recursive: true });
  }
}
export function pricesFor(modelIds: string[]) {
  if (modelIds.every((model) => GATEWAY_PRICES.models[model])) {
    return Promise.resolve(GATEWAY_PRICES);
  }

  refreshed ??= refresh();
  return refreshed;
}
