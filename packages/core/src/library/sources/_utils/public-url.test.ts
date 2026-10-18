import { type LookupAddress } from "node:dns";
import { type Server, createServer } from "node:http";
import { type AddressInfo } from "node:net";
import { type fetch } from "undici";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { publicAgent, publicLookup } from "./public-url";

/** Undici's real fetch, which research's requests go through (other tests replace it). */
const { fetch: realFetch } = await vi.importActual<{ fetch: typeof fetch }>("undici");

/** Resolves a host name the way a connection does, through the public-address rule. */
function resolve(hostname: string): Promise<LookupAddress[]> {
  return new Promise((resolveAddresses, reject) => {
    publicLookup(hostname, { all: true }, (error, addresses) => {
      if (error) {
        reject(error);
        return;
      }

      resolveAddresses(Array.isArray(addresses) ? addresses : []);
    });
  });
}

describe(publicLookup, () => {
  // An address resolves to itself without asking DNS, so each network is checked offline.
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "224.0.0.1",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
  ])("refuses %s, which isn't on the public internet", async (address) => {
    await expect(resolve(address)).rejects.toThrow("Refusing to connect");
  });

  it.each(["8.8.8.8", "100.128.0.1", "172.32.0.1", "192.169.0.1", "2606:4700:4700::1111"])(
    "connects to %s, a public address",
    async (address) => {
      await expect(resolve(address)).resolves.toStrictEqual([
        { address, family: address.includes(":") ? 6 : 4 },
      ]);
    },
  );

  it("refuses a name that resolves to this machine", async () => {
    await expect(resolve("localhost")).rejects.toThrow("Refusing to connect to localhost");
  });
});

describe("fetching through the public agent", () => {
  /** A server on this machine, which a public-looking name could point at. */
  let server: Server;
  const connected = vi.fn();

  beforeAll(async () => {
    server = createServer((_request, response) => response.end("private"));
    server.on("connection", connected);

    await new Promise<void>((resolveListening) => {
      server.listen(0, "127.0.0.1", resolveListening);
    });
  });

  afterAll(async () => {
    server.closeAllConnections();

    await new Promise((resolveClosed) => {
      server.close(resolveClosed);
    });
  });

  it("makes fetch refuse a name that resolves to a private address, without connecting", async () => {
    const { port } = server.address() as AddressInfo;

    const failure = await realFetch(`http://localhost:${port}/`, { dispatcher: publicAgent }).catch(
      (error: unknown) => error,
    );

    expect(failure).toMatchObject({
      cause: { message: expect.stringContaining("Refusing to connect to localhost") },
    });

    expect(connected).not.toHaveBeenCalled();
  });
});
