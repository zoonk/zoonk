/**
 * Saves the gateway's current token prices to data/gateway-prices.json.
 * Run it after adding a model or when a provider changes its prices.
 */
import { refreshGatewayPrices } from "@/lib/gateway-prices";

const prices = await refreshGatewayPrices();

process.stdout.write(
  `Saved prices for ${Object.keys(prices.models).length} models from ${prices.source} at ${prices.fetchedAt}.\n`,
);
