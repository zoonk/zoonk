import { describe, expect, it } from "vitest";
import { type ProductSites, isOfficialPage, isProductOfBrand, readPageTags } from "./product-sites";

const BASE = "https://orbit.example/notes/";

function page({ domain, links }: { domain: string; links: string[] }) {
  return { domain, tags: { iconUrl: null, imageUrl: null, links }, url: `https://${domain}/` };
}

describe(readPageTags, () => {
  it("reads absolute links, the touch icon and the share image", () => {
    const html = `<head>
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
      <link rel='apple-touch-icon' href='/touch.png'>
      <meta property="og:image" content="https://cdn.orbit.example/share.png?a=1&amp;b=2">
    </head>
    <a href="../docs#start">Docs</a><a href="https://lumen.example">Lumen</a>
    <a href="mailto:hi@orbit.example">Mail</a><a href=/pricing>Pricing</a>`;

    expect(readPageTags({ base: BASE, html })).toStrictEqual({
      iconUrl: "https://orbit.example/touch.png",
      imageUrl: "https://cdn.orbit.example/share.png?a=1&b=2",
      links: [
        "https://orbit.example/docs",
        "https://lumen.example/",
        "https://orbit.example/pricing",
      ],
    });
  });

  it("prefers a scalable icon, then the largest bitmap", () => {
    const icons = `<link rel="icon" href="/16.png" sizes="16x16"><link rel="shortcut icon" href="/64.png" sizes="64x64">`;

    expect(readPageTags({ base: BASE, html: icons }).iconUrl).toBe("https://orbit.example/64.png");

    expect(
      readPageTags({ base: BASE, html: `${icons}<link rel="icon" href="/logo.svg">` }).iconUrl,
    ).toBe("https://orbit.example/logo.svg");
  });

  it("finds nothing in a page without tags", () => {
    expect(readPageTags({ base: BASE, html: "plain text" })).toStrictEqual({
      iconUrl: null,
      imageUrl: null,
      links: [],
    });
  });
});

describe(isProductOfBrand, () => {
  it("ties a product on the brand's own domain", () => {
    expect(
      isProductOfBrand({
        brand: page({ domain: "lumen.example", links: [] }),
        product: page({ domain: "lumen.example", links: [] }),
      }),
    ).toBe(true);
  });

  it("ties a product site and a brand site that link to each other", () => {
    expect(
      isProductOfBrand({
        brand: page({ domain: "lumen.example", links: ["https://docs.orbit.example/x"] }),
        product: page({ domain: "orbit.example", links: ["https://www.lumen.example/about"] }),
      }),
    ).toBe(true);
  });

  it("ignores links in comments and scripts, which no visitor follows", () => {
    const hidden = readPageTags({
      base: "https://lumen.example/",
      html: `<!-- <a href="https://impostor.example/">old</a> --><script>"<a href='https://impostor.example/x'>"</script><a href="/about">About</a>`,
    });

    expect(hidden.links).toStrictEqual(["https://lumen.example/about"]);

    expect(
      isProductOfBrand({
        brand: { ...page({ domain: "lumen.example", links: [] }), tags: hidden },
        product: page({ domain: "impostor.example", links: ["https://lumen.example/"] }),
      }),
    ).toBe(false);
  });

  it.each([
    [
      "a nested template",
      "<template><template></template><a href='https://impostor.example/'>x</a></template>",
    ],
    ["an unterminated comment", "<!-- <a href='https://impostor.example/'>x</a>"],
    ["an unterminated script", "<script>const a = \"<a href='https://impostor.example/'>x</a>\";"],
  ])("ignores a link inside %s", (_case, html) => {
    expect(
      readPageTags({ base: "https://lumen.example/", html: `${html}<a href="/about">About</a>` })
        .links,
    ).not.toContain("https://impostor.example/");
  });

  it("refuses a page that links to a brand the brand never links back to", () => {
    expect(
      isProductOfBrand({
        brand: page({ domain: "lumen.example", links: ["https://lumen.example/careers"] }),
        product: page({ domain: "copycat.example", links: ["https://lumen.example/"] }),
      }),
    ).toBe(false);
  });
});

describe(isOfficialPage, () => {
  const sites: ProductSites = {
    brand: { domain: "lumen.example", iconUrl: null, url: "https://lumen.example/" },
    product: {
      domain: "orbit.example",
      imageUrl: null,
      links: ["https://code.example/lumen/orbit", "https://code.example/"],
      url: "https://orbit.example/",
    },
  };

  it("accepts pages on the brand's or the product's domain", () => {
    expect(isOfficialPage({ sites, url: "https://blog.lumen.example/orbit-5" })).toBe(true);
    expect(isOfficialPage({ sites, url: "https://docs.orbit.example/" })).toBe(true);
  });

  it("accepts pages under a path the product page links to", () => {
    expect(isOfficialPage({ sites, url: "https://code.example/lumen/orbit/releases" })).toBe(true);
  });

  it("refuses other sites, a sibling path and a site's root link", () => {
    expect(isOfficialPage({ sites, url: "https://reviews.example/orbit" })).toBe(false);
    expect(isOfficialPage({ sites, url: "https://code.example/lumen/orbit-fork" })).toBe(false);
    expect(isOfficialPage({ sites, url: "https://code.example/someone/else" })).toBe(false);
  });
});
