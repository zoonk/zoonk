/**
 * Saves the gateway's current prices to src/pricing/gateway-prices.json, the price list every AI
 * call and eval run is priced with. Run it after adding a model or when a provider changes its
 * prices, and check the models we run against the providers' pricing pages.
 */
import { refreshGatewayPrices } from "../src/pricing/gateway-prices";

const file = new URL("../src/pricing/gateway-prices.json", import.meta.url);
const prices = await refreshGatewayPrices(file);

process.stdout.write(
  `Saved prices for ${Object.keys(prices.models).length} models from ${prices.source} at ${prices.fetchedAt}.\n`,
);
