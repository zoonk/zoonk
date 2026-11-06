import { describe, expect, it } from "vitest";
import { type ProductSites, isOfficialPage, isProductOfBrand, readPageTags } from "./product-sites";

const BASE = "https://orbit.example/notes/";

function page({ domain, links }: { domain: string; links: string[] }) {
  return { domain, tags: { iconUrl: null, imageUrl: null, links }, url: `https://${domain}/` };
}

function readHtml(html: string) {
  return readPageTags({ html, url: BASE });
}

describe(readPageTags, () => {
  it("reads absolute links, the touch icon and the share image", () => {
    const html = `<html><head>
      <link rel="icon" href="/favicon-32.png" sizes="32x32">
      <link rel='apple-touch-icon' href='/touch.png'>
      <meta property="og:image" content="https://cdn.orbit.example/share.png?a=1&amp;b=2">
    </head><body>
    <a href="../docs#start">Docs</a><a href="https://lumen.example">Lumen</a>
    <a href="mailto:hi@orbit.example">Mail</a><a href=/pricing>Pricing</a></body></html>`;

    expect(readHtml(html)).toStrictEqual({
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

    expect(readHtml(icons)).toMatchObject({ iconUrl: "https://orbit.example/64.png" });

    expect(readHtml(`${icons}<link rel="icon" href="/logo.svg">`)).toMatchObject({
      iconUrl: "https://orbit.example/logo.svg",
    });
  });

  it("finds nothing in a page without tags", () => {
    expect(readHtml("plain text")).toStrictEqual({ iconUrl: null, imageUrl: null, links: [] });
  });

  it("ignores links no visitor can follow and keeps the visible ones around them", () => {
    const html = `<html><body>
      <!-- <a href="https://hidden.example/1">old</a> -->
      <template><!-- </template> --><a href="https://hidden.example/2">x</a></template>
      <template><template></template><a href="https://hidden.example/3">x</a></template>
      <script type="application/json">"</scripture><a href='https://hidden.example/4'>x</a>"</script>
      <div data-example="<script>">Example</div><a href="https://visible.example/1">Product</a>
      <script type="application/json">"İİİİİİİİİİ"</script><a href="https://visible.example/2">More</a>
      </body></html>`;

    expect(readHtml(html)).toMatchObject({
      links: ["https://visible.example/1", "https://visible.example/2"],
    });
  });

  it("keeps a card link around block content and an image-only or SVG-only link", () => {
    const html = `<a href="https://card.example/"><h2>Product</h2><p>Explore</p></a>
      <a href="https://image.example/"><img src="/x.png" alt=""></a>
      <a href="https://svg.example/"><svg viewBox="0 0 1 1"><path d="M0 0h1"/></svg></a>`;

    expect(readHtml(html).links).toStrictEqual([
      "https://card.example/",
      "https://image.example/",
      "https://svg.example/",
    ]);
  });

  it("counts a link's address, never a wiki attribute", () => {
    const html = `<a href="/about" data-wikilink-page="https://hidden.example/">About</a>
      <a data-wikilink data-target="https://hidden.example/2">Wiki</a>`;

    expect(readHtml(html).links).toStrictEqual(["https://orbit.example/about"]);
  });

  it("resolves links against the page's base address", () => {
    expect(
      readHtml(`<base href="https://cdn.orbit.example/"><a href="docs">Docs</a>`).links,
    ).toStrictEqual(["https://cdn.orbit.example/docs"]);
  });

  it.each([
    [
      "an escaped script",
      `<script><!--<script></script><a href="https://hidden.example/">X</a></script>`,
    ],
    ["plaintext", `<plaintext><a href="https://hidden.example/">X</a>`],
    ["an unterminated comment", "<!-- <a href='https://hidden.example/'>x</a>"],
    ["an unterminated script", "<script>const a = \"<a href='https://hidden.example/'>x</a>\";"],
  ])("ignores a link inside %s", (_case, html) => {
    const { links } = readHtml(`<html><body>${html}</body></html>`);
    expect(links).not.toContain("https://hidden.example/");
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
