import { describe, expect, it } from "vitest";
import { getAddressKey, getNetworkKey, isNetworkKey } from "./network-key";

const JA4_CHROME = "t13d1516h2_8daaf6152771_02713d6af862";
const JA4_BOT = "t13d190900_9dc949149365_97f8aa674fd9";

describe(getNetworkKey, () => {
  it("keys on the network address and TLS fingerprint together", () => {
    const chrome = getNetworkKey(
      new Headers({ "x-real-ip": "203.0.113.7", "x-vercel-ja4-digest": JA4_CHROME }),
    );

    const sameBrowser = getNetworkKey(
      new Headers({ "x-real-ip": "203.0.113.7", "x-vercel-ja4-digest": JA4_CHROME }),
    );

    const otherClient = getNetworkKey(
      new Headers({ "x-real-ip": "203.0.113.7", "x-vercel-ja4-digest": JA4_BOT }),
    );

    const otherNetwork = getNetworkKey(
      new Headers({ "x-real-ip": "198.51.100.1", "x-vercel-ja4-digest": JA4_CHROME }),
    );

    expect(chrome).toBe(sameBrowser);
    expect(new Set([chrome, otherClient, otherNetwork]).size).toBe(3);
  });

  it("uses the original client address and never exposes it", () => {
    const key = getNetworkKey(
      new Headers({
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "x-real-ip": "10.0.0.1",
        "x-vercel-ja4-digest": JA4_CHROME,
      }),
    );

    expect(key).toBe(
      getNetworkKey(new Headers({ "x-real-ip": "203.0.113.7", "x-vercel-ja4-digest": JA4_CHROME })),
    );

    expect(key).toMatch(/^network:[0-9a-f]{32}$/u);
    expect(key).not.toContain("203.0.113.7");
  });
});

function keyOf(address: string) {
  return getAddressKey(new Headers({ "x-vercel-forwarded-for": address }));
}

describe(getAddressKey, () => {
  it("keys on the address alone, so a new TLS fingerprint doesn't make a new client", () => {
    const chrome = new Headers({ "x-real-ip": "203.0.113.7", "x-vercel-ja4-digest": JA4_CHROME });
    const bot = new Headers({ "x-real-ip": "203.0.113.7", "x-vercel-ja4-digest": JA4_BOT });

    expect(getAddressKey(chrome)).toBe(getAddressKey(bot));
    expect(getNetworkKey(chrome)).not.toBe(getNetworkKey(bot));
    expect(getAddressKey(chrome)).toMatch(/^address:[0-9a-f]{32}$/u);
    expect(getAddressKey(chrome)).not.toContain("203.0.113.7");
  });

  it("gives every address in one IPv6 /64 the same key, however it's written", () => {
    const home = keyOf("2001:db8:85a3:8d3:1319:8a2e:370:7348");

    expect(keyOf("2001:0DB8:85A3:08D3::1")).toBe(home);
    expect(keyOf("2001:db8:85a3:8d3:ffff:ffff:ffff:ffff%en0")).toBe(home);
    expect(keyOf("2001:db8:85a3:8d4::1")).not.toBe(home);
    expect(keyOf("2001:db8::1")).toBe(keyOf("2001:db8:0:0:1::1"));
  });

  it("treats an IPv4 address mapped into IPv6 as that IPv4 address", () => {
    expect(getAddressKey(new Headers({ "x-real-ip": "::ffff:203.0.113.7" }))).toBe(
      getAddressKey(new Headers({ "x-real-ip": "203.0.113.7" })),
    );
  });
});

describe(isNetworkKey, () => {
  it("tells a network key from an account key", () => {
    expect(isNetworkKey(getNetworkKey(new Headers()))).toBe(true);
    expect(isNetworkKey("user:learner")).toBe(false);
  });
});
