import { lookup } from "node:dns";
import { BlockList, type IPVersion, type LookupFunction, isIPv6 } from "node:net";
import { Agent } from "undici";

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".test"];
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/u;
/** A name may end with the DNS root's dot ("localhost."), which names the same host. */
const ROOT_DOTS = /\.+$/u;

/**
 * Networks no public web page is on. An IPv4 address written as IPv6 (`::ffff:127.0.0.1`) is
 * checked against its IPv4 network: BlockList matches both forms.
 */
const NON_PUBLIC_NETWORKS: [IPVersion, string][] = [
  ["ipv4", "0.0.0.0/8"], // "this" network: 0.0.0.0 reaches the server itself
  ["ipv4", "10.0.0.0/8"],
  ["ipv4", "100.64.0.0/10"], // carrier-grade NAT
  ["ipv4", "127.0.0.0/8"],
  ["ipv4", "169.254.0.0/16"], // link-local, where cloud metadata answers
  ["ipv4", "172.16.0.0/12"],
  ["ipv4", "192.168.0.0/16"],
  ["ipv4", "224.0.0.0/4"], // multicast
  ["ipv6", "::/128"],
  ["ipv6", "::1/128"],
  ["ipv6", "fc00::/7"], // unique local
  ["ipv6", "fe80::/10"], // link-local
  ["ipv6", "ff00::/8"], // multicast
];

const nonPublicAddresses = new BlockList();

NON_PUBLIC_NETWORKS.forEach(([type, network]) => {
  const [address = "", prefix] = network.split("/");
  nonPublicAddresses.addSubnet(address, Number(prefix), type);
});

function isPublicAddress(address: string): boolean {
  return !nonPublicAddresses.check(address, isIPv6(address) ? "ipv6" : "ipv4");
}

/** Only public web pages are fetched: never an address, a local name or credentials. */
function isPublicHostname(hostname: string): boolean {
  const name = hostname.replace(ROOT_DOTS, "");

  if (name === "localhost" || name.startsWith("[") || IPV4_PATTERN.test(name)) {
    return false;
  }

  return name.includes(".") && !BLOCKED_HOST_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/**
 * The one rule for every address research requests, including the ones a remote server hands
 * over (a redirect, a certificate's issuer), so none of them can point a request at a private
 * network. A public-looking name can still resolve to one, which `publicLookup` refuses when the
 * request connects.
 */
export function isPublicUrl(url: URL): boolean {
  return (
    (url.protocol === "https:" || url.protocol === "http:") &&
    !url.username &&
    !url.password &&
    isPublicHostname(url.hostname)
  );
}

/**
 * Resolves a host name as Node does, refusing it when any of its addresses isn't public. Every
 * connection research opens resolves its host through this, so the address checked is the one
 * connected to: a name can't point a request at a private network, not even by answering
 * differently the second time it's asked.
 */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      callback(error, []);
      return;
    }

    const refused = addresses.find(({ address }) => !isPublicAddress(address));

    if (refused) {
      callback(new Error(`Refusing to connect to ${hostname} at ${refused.address}`), []);
      return;
    }

    if (options.all) {
      callback(null, addresses);
      return;
    }

    const [first] = addresses;
    callback(null, first?.address ?? "", first?.family);
  });
};

/**
 * What research's fetches connect through, so each connection's host resolves through
 * `publicLookup`. It goes with undici's own fetch: Node's built-in one is another undici version.
 */
export const publicAgent = new Agent({ connect: { lookup: publicLookup } });
