import { assert, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import { namesAnyProduct, toNameKey, toRegistrableDomain, toVersionKey } from "./product-keys";

describe(toNameKey, () => {
  it("gives the ways learners write a product one key", () => {
    expect(
      ["Next.js", "next js", "NextJS", " NEXT-JS "].map((name) => toNameKey(name)),
    ).toStrictEqual(["nextjs", "nextjs", "nextjs", "nextjs"]);
  });

  it("keeps accented and non-Latin names apart from their spaces and punctuation", () => {
    expect(toNameKey("Café Pilão")).toBe("cafepilao");
    expect(toNameKey("İstanbul Kart")).toBe("istanbulkart");
    expect(toNameKey("ファミマ アプリ")).toBe("ファミマアプリ");
    expect(toNameKey("कोटक बैंक")).toBe(toNameKey("कोटकबैंक"));
  });

  it("keeps versions apart that differ only in where their numbers break", () => {
    expect(toNameKey("Python 3.12")).not.toBe(toNameKey("Python 3.1.2"));
    expect(toNameKey("Python 3 12")).toBe(toNameKey("Python 3.12"));
    expect(toNameKey("Windows 11 24H2")).toBe("windows11.24h2");
  });

  it("is made of letters, marks and digits, with a dot only between digits, and keying a key changes nothing", () => {
    assert(
      property(string({ unit: "grapheme" }), (name) => {
        const key = toNameKey(name);
        expect(key).toMatch(/^(?:[\p{L}\p{M}\p{N}]|(?<=\p{N})\.(?=\p{N}))*$/u);
        expect(toNameKey(key)).toBe(key);
      }),
    );
  });
});

describe(toVersionKey, () => {
  it("treats a leading v as part of the way versions are written", () => {
    expect(["v16", "16", "V16"].map((version) => toVersionKey(version))).toStrictEqual([
      "16",
      "16",
      "16",
    ]);

    expect(toVersionKey("Vista")).toBe("vista");
    expect(toVersionKey("3.12")).not.toBe(toVersionKey("3.1.2"));
  });
});

describe(toRegistrableDomain, () => {
  it("reads the domain a brand registered, wherever its site lives", () => {
    expect(toRegistrableDomain("https://www.apple.com/iphone/")).toBe("apple.com");
    expect(toRegistrableDomain("nextjs.org")).toBe("nextjs.org");
    expect(toRegistrableDomain("https://natura.com.br/")).toBe("natura.com.br");
    expect(toRegistrableDomain("https://www.bbc.co.uk/news")).toBe("bbc.co.uk");
  });

  it("tells apart two sites hosted on one platform", () => {
    expect(toRegistrableDomain("https://first.github.io/docs")).toBe("first.github.io");
    expect(toRegistrableDomain("https://second.github.io/docs")).toBe("second.github.io");
  });

  it("has no domain for an address, a bare suffix or a local name", () => {
    expect(toRegistrableDomain("http://127.0.0.1/")).toBeNull();
    expect(toRegistrableDomain("github.io")).toBeNull();
    expect(toRegistrableDomain("localhost")).toBeNull();
  });

  it("never throws on text that isn't an address", () => {
    assert(
      property(string(), (text) => {
        expect(() => toRegistrableDomain(text)).not.toThrow();
      }),
    );
  });
});

describe(namesAnyProduct, () => {
  it("finds another product's name in whole words, outside the words naming this product", () => {
    const own = ["Orbit Server"];
    const keys = ["orbit", "cometphone"];

    expect(
      ["| Orbit Server | 1.36 |", "| Orbit | 2.0 |", "Comet Phone 1.37", "Cometphones 4"].map(
        (text) => namesAnyProduct({ keys, own, text }),
      ),
    ).toStrictEqual([false, true, true, false]);
  });

  it("finds a name of any length", () => {
    const keys = [toNameKey("Microsoft Dynamics 365 Finance and Operations")];

    expect([
      namesAnyProduct({
        keys,
        own: [],
        text: "Microsoft Dynamics 365 Finance and Operations 10.0.45",
      }),
      namesAnyProduct({ keys, own: [], text: "Microsoft Dynamics 365 Finance 10.0.45" }),
    ]).toStrictEqual([true, false]);
  });
});
