import { refreshGatewayPrices } from "../src/pricing/gateway-prices";

const file = new URL("../src/pricing/gateway-prices.json", import.meta.url);
const prices = await refreshGatewayPrices(file);

process.stdout.write(
  `Saved prices for ${Object.keys(prices.models).length} models from ${prices.source} at ${prices.fetchedAt}.\n`,
);
