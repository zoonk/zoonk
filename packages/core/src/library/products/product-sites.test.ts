import { Response as PageResponse, fetch } from "undici";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ProductSites, inspectProductSites, isOfficialPage } from "./product-sites";

function requestedUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }

  return "href" in input ? input.href : input.url;
}

/**
 * Serves each address's page, linking to the addresses given, or a redirect to `{ redirect }`;
 * anything else is a 404.
 */
function serve(pages: Record<string, string[] | { redirect: string }>) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const links = pages[requestedUrl(input)];

    if (!links) {
      return new PageResponse("", { status: 404 });
    }

    if (!Array.isArray(links)) {
      return new PageResponse(null, { headers: { location: links.redirect }, status: 302 });
    }

    const anchors = links.map((link) => `<a href="${link}">link</a>`).join("");

    return new PageResponse(`<html><body>${anchors}</body></html>`, {
      headers: { "content-type": "text/html" },
    });
  });
}

function inspect(brandUrl: string | null, productUrl = "https://orbit.example/") {
  return inspectProductSites({ brandUrl, productName: "Orbit Notes", productUrl });
}

describe(inspectProductSites, () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it("ties a product on the brand's own domain", async () => {
    serve({ "https://lumen.example/": [], "https://lumen.example/orbit": [] });

    await expect(
      inspect("https://lumen.example/", "https://lumen.example/orbit"),
    ).resolves.toMatchObject({
      brand: { domain: "lumen.example" },
      product: { domain: "lumen.example" },
    });
  });

  it("ties a product site and a brand site that link to each other", async () => {
    serve({
      "https://lumen.example/": ["https://docs.orbit.example/x"],
      "https://orbit.example/": ["https://www.lumen.example/about"],
    });

    await expect(inspect("https://lumen.example/")).resolves.not.toBeNull();
  });

  it("ties when the brand's own page about the product, one hop away, links to its site", async () => {
    serve({
      "https://lumen.example/": ["/careers", "/products/orbit-notes"],
      "https://lumen.example/products/orbit-notes": ["https://orbit.example/"],
      "https://orbit.example/": ["https://lumen.example/"],
    });

    await expect(inspect("https://lumen.example/")).resolves.toMatchObject({
      brand: { domain: "lumen.example" },
      product: { domain: "orbit.example" },
    });
  });

  it("ties a repository on a code host that the brand links to", async () => {
    serve({
      "https://code.example/lumen/orbit": ["https://lumen.example/"],
      "https://lumen.example/": ["https://code.example/lumen/orbit/releases"],
    });

    await expect(
      inspect("https://lumen.example/", "https://code.example/lumen/orbit"),
    ).resolves.toMatchObject({ product: { domain: "code.example" } });
  });

  it("refuses a repository on a code host when the brand links only another one there", async () => {
    serve({
      "https://code.example/copycat/orbit": ["https://lumen.example/"],
      "https://lumen.example/": ["https://code.example/lumen/website", "/products/orbit-notes"],
      "https://lumen.example/products/orbit-notes": ["https://code.example/lumen/orbit"],
    });

    await expect(
      inspect("https://lumen.example/", "https://code.example/copycat/orbit"),
    ).resolves.toBeNull();
  });

  it("ties a product page with a path on the brand's own domain", async () => {
    serve({
      "https://www.lumen.example/": [],
      "https://www.lumen.example/products/orbit/": ["https://www.lumen.example/"],
    });

    await expect(
      inspect("https://www.lumen.example/", "https://www.lumen.example/products/orbit/"),
    ).resolves.toMatchObject({ brand: { domain: "lumen.example" } });
  });

  it("refuses a brand page with a path, such as an organization's page on a code host", async () => {
    serve({ "https://code.example/lumen": [], "https://code.example/lumen/orbit": [] });

    await expect(
      inspect("https://code.example/lumen", "https://code.example/lumen/orbit"),
    ).resolves.toBeNull();
  });

  it("refuses a brand homepage that redirects to another site", async () => {
    serve({
      "https://code.example/lumen": ["https://code.example/lumen/orbit"],
      "https://code.example/lumen/orbit": ["https://lumen.example/"],
      "https://lumen.example/": { redirect: "https://code.example/lumen" },
    });

    await expect(
      inspect("https://lumen.example/", "https://code.example/lumen/orbit"),
    ).resolves.toBeNull();
  });

  it("takes a product site at its domain's root as its own brand when no brand page was found", async () => {
    serve({ "https://orbit.example/": [], "https://www.orbit.example/": [] });

    await expect(inspect(null, "https://www.orbit.example/")).resolves.toMatchObject({
      brand: { domain: "orbit.example", url: "https://orbit.example/" },
      product: { domain: "orbit.example" },
    });
  });

  it("gives a project on a code host with no brand page no brand", async () => {
    serve({ "https://code.example/": [], "https://code.example/someone/orbit": [] });

    await expect(inspect(null, "https://code.example/someone/orbit")).resolves.toBeNull();
  });

  it("refuses a third-party site that links to a brand that never links back", async () => {
    serve({
      "https://copycat.example/": ["https://lumen.example/"],
      "https://lumen.example/": ["/careers", "/products/orbit-notes"],
      "https://lumen.example/products/orbit-notes": ["https://orbit.example/"],
    });

    await expect(inspect("https://lumen.example/", "https://copycat.example/")).resolves.toBeNull();
  });

  it("refuses a vouching page the brand's homepage doesn't link to", async () => {
    serve({
      "https://lumen.example/": ["/careers"],
      "https://lumen.example/products/orbit-notes": ["https://orbit.example/"],
      "https://orbit.example/": ["https://lumen.example/"],
    });

    await expect(inspect("https://lumen.example/")).resolves.toBeNull();
  });

  it("takes the product site's registrable domain as the brand when no brand page was found", async () => {
    serve({ "https://developer.lumen.example/orbit": [], "https://lumen.example/": [] });

    await expect(inspect(null, "https://developer.lumen.example/orbit")).resolves.toMatchObject({
      brand: { domain: "lumen.example", url: "https://lumen.example/" },
      product: { domain: "lumen.example" },
    });
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

  it("accepts any page on the brand's domain, such as docs on its subdomain", () => {
    const onBrand: ProductSites = {
      ...sites,
      product: {
        ...sites.product,
        domain: "lumen.example",
        links: [],
        url: "https://www.lumen.example/products/orbit/",
      },
    };

    expect(
      isOfficialPage({ sites: onBrand, url: "https://docs.lumen.example/orbit/release-notes/" }),
    ).toBe(true);
  });

  it("accepts pages under a path the product page links to", () => {
    expect(isOfficialPage({ sites, url: "https://code.example/lumen/orbit/releases" })).toBe(true);
  });

  it("accepts only what a linked repository's maker publishes: the repository, its releases and tags", () => {
    const repository = "https://code.example/lumen/orbit";

    expect(isOfficialPage({ sites, url: repository })).toBe(true);
    expect(isOfficialPage({ sites, url: `${repository}/releases/tag/v5.0.1` })).toBe(true);
    expect(isOfficialPage({ sites, url: `${repository}/tags` })).toBe(true);
    expect(isOfficialPage({ sites, url: `${repository}/-/releases` })).toBe(true);
    expect(isOfficialPage({ sites, url: `${repository}/issues/1234` })).toBe(false);
    expect(isOfficialPage({ sites, url: `${repository}/discussions/7` })).toBe(false);
    expect(isOfficialPage({ sites, url: `${repository}/pull/12` })).toBe(false);
    expect(isOfficialPage({ sites, url: `${repository}/wiki/Releases` })).toBe(false);
  });

  it.each(["issues/123", "discussions/7", "pull/5", "-/merge_requests/3", "wiki/Releases"])(
    "refuses a %s page even when the product page links straight to it",
    (path) => {
      const link = `https://code.example/lumen/orbit/${path}`;
      const linked = { ...sites, product: { ...sites.product, links: [link] } };

      expect(isOfficialPage({ sites: linked, url: link })).toBe(false);
    },
  );

  it("accepts a release under a stored releases page", () => {
    const stored = {
      ...sites,
      product: { ...sites.product, links: [`${sites.product.links[0]}/releases`] },
    };

    expect(
      isOfficialPage({ sites: stored, url: "https://code.example/lumen/orbit/releases/tag/v5" }),
    ).toBe(true);
  });

  it("keeps a product page on a code host from making the rest of that host official", () => {
    const hosted: ProductSites = {
      ...sites,
      product: {
        ...sites.product,
        domain: "code.example",
        links: [],
        url: "https://code.example/lumen/orbit",
      },
    };

    const official = (url: string) => isOfficialPage({ sites: hosted, url });

    expect(official("https://code.example/lumen/orbit/releases")).toBe(true);
    expect(official("https://code.example/lumen/orbit/issues/1")).toBe(false);
    expect(official("https://code.example/copycat/orbit/releases")).toBe(false);
  });

  it("refuses other sites, a sibling path and a site's root link", () => {
    expect(isOfficialPage({ sites, url: "https://reviews.example/orbit" })).toBe(false);
    expect(isOfficialPage({ sites, url: "https://code.example/lumen/orbit-fork" })).toBe(false);
    expect(isOfficialPage({ sites, url: "https://code.example/someone/else" })).toBe(false);
  });
});
