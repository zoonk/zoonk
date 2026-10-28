import { lookup } from "node:dns";
import { BlockList, type IPVersion, type LookupFunction, isIPv6 } from "node:net";
import { Agent } from "undici";

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".test"];
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/u;
/** A name may end with the DNS root's dot ("localhost."), which names the same host. */
const ROOT_DOTS = /\.+$/u;

/** BlockList also matches IPv4-mapped IPv6 addresses against their IPv4 network. */
const NON_PUBLIC_NETWORKS: [IPVersion, string][] = [
  ["ipv4", "0.0.0.0/8"],
  ["ipv4", "10.0.0.0/8"],
  ["ipv4", "100.64.0.0/10"],
  ["ipv4", "127.0.0.0/8"],
  ["ipv4", "169.254.0.0/16"],
  ["ipv4", "172.16.0.0/12"],
  ["ipv4", "192.168.0.0/16"],
  ["ipv4", "224.0.0.0/4"],
  ["ipv6", "::/128"],
  ["ipv6", "::1/128"],
  ["ipv6", "fc00::/7"],
  ["ipv6", "fe80::/10"],
  ["ipv6", "ff00::/8"],
];

const nonPublicAddresses = new BlockList();

NON_PUBLIC_NETWORKS.forEach(([type, network]) => {
  const [address = "", prefix] = network.split("/");
  nonPublicAddresses.addSubnet(address, Number(prefix), type);
});

function isPublicAddress(address: string): boolean {
  return !nonPublicAddresses.check(address, isIPv6(address) ? "ipv6" : "ipv4");
}

function isPublicHostname(hostname: string): boolean {
  const name = hostname.replace(ROOT_DOTS, "");

  if (name === "localhost" || name.startsWith("[") || IPV4_PATTERN.test(name)) {
    return false;
  }

  return name.includes(".") && !BLOCKED_HOST_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

export function isPublicUrl(url: URL): boolean {
  return (
    (url.protocol === "https:" || url.protocol === "http:") &&
    !url.username &&
    !url.password &&
    isPublicHostname(url.hostname)
  );
}

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

/** Use with undici's own fetch; Node's built-in fetch uses a different undici version. */
export const publicAgent = new Agent({ connect: { lookup: publicLookup } });
