import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { request } from "node:https";
import { homedir } from "node:os";
import { join } from "node:path";
import { AUTH_BASE_PATH } from "../../apps/api/src/lib/auth-base-path.ts";
import { getPortlessEnvironment, getServiceUrl } from "./config.mts";
import { applyCommandExit, runForegroundCommand } from "./process.mts";
import { startProxy } from "./proxy.mts";
import { SERVICE_HOST } from "./service-port.mts";

const currentDirectory = process.cwd();
const lanMode = process.argv.includes("--lan");
const portless = getPortlessEnvironment({ homeDirectory: homedir(), lanMode });
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;

function getApiUrl(): string {
  if (process.env.PORTLESS === "0") {
    return "http://localhost:4000";
  }

  const environment = { ...process.env, ...portless };

  startProxy({ currentDirectory, environment });

  return getServiceUrl({ currentDirectory, environment, serviceName: "api" });
}

async function listenForStripe(webhook: URL) {
  const result = await runForegroundCommand({
    args: [
      "listen",
      "--events",
      "checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted",
      "--forward-to",
      webhook.href,
    ],
    command: "stripe",
    currentDirectory,
    environment: process.env,
  });

  applyCommandExit(result);
}

/** Stripe's CLI uses the system trust store. Keep its local hop on loopback and verify Portless with its own CA. */
async function listenOverLan(webhook: URL) {
  const ca = readFileSync(join(portless.PORTLESS_STATE_DIR, "ca.pem"));

  const relay = createServer((incoming, outgoing) => {
    if (incoming.method !== "POST" || incoming.url !== webhook.pathname) {
      outgoing.writeHead(HTTP_NOT_FOUND).end();
      return;
    }

    const upstream = request(
      webhook,
      {
        ca,
        headers: {
          "content-type": incoming.headers["content-type"] ?? "application/json",
          "stripe-signature": incoming.headers["stripe-signature"] ?? "",
        },
        method: "POST",
        rejectUnauthorized: true,
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? HTTP_BAD_GATEWAY);
        response.on("error", () => outgoing.destroy());
        response.pipe(outgoing);
      },
    );

    upstream.on("error", () => {
      if (outgoing.headersSent) {
        outgoing.destroy();
      } else {
        outgoing.writeHead(HTTP_BAD_GATEWAY).end("Could not reach the LAN API.");
      }
    });

    outgoing.on("close", () => upstream.destroy());
    incoming.pipe(upstream);
  });

  relay.listen(0, SERVICE_HOST);
  await once(relay, "listening");

  try {
    const address = relay.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not bind the Stripe listener to loopback.");
    }

    await listenForStripe(new URL(webhook.pathname, `http://${SERVICE_HOST}:${address.port}`));
  } finally {
    relay.close();
    relay.closeAllConnections();
  }
}

const webhook = new URL(`${AUTH_BASE_PATH}/stripe/webhook`, getApiUrl());

if (lanMode && webhook.protocol === "https:") {
  await listenOverLan(webhook);
} else {
  await listenForStripe(webhook);
}
