import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDocument, toSourceUrl } from "./fetch-document";

describe(toSourceUrl, () => {
  it("drops the fragment so two links to one notice are one source", () => {
    expect(toSourceUrl("https://www.gov.br/inep/edital.pdf#page=3")).toBe(
      "https://www.gov.br/inep/edital.pdf",
    );
  });

  it("refuses anything that isn't a public web page", () => {
    expect(toSourceUrl("ftp://example.com/file.pdf")).toBeNull();
    expect(toSourceUrl("http://localhost:3000/edital")).toBeNull();
    expect(toSourceUrl("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(toSourceUrl("http://[::1]/edital")).toBeNull();
    expect(toSourceUrl("https://printer.local/scan.pdf")).toBeNull();
    expect(toSourceUrl("https://user:secret@example.com/edital")).toBeNull();
    expect(toSourceUrl("not a url")).toBeNull();
  });
});

describe(fetchDocument, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the bytes and the bare content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<p>Edital</p>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
        ),
    );

    const document = await fetchDocument("https://www.gov.br/inep/edital#top");

    expect(document.contentType).toBe("text/html");
    expect(document.url).toBe("https://www.gov.br/inep/edital");
    expect(new TextDecoder().decode(document.bytes)).toBe("<p>Edital</p>");
  });

  // A public page could otherwise redirect the fetch to an internal address.
  it("refuses a redirect to a private address", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { headers: { location: "http://127.0.0.1/admin" }, status: 302 }),
        ),
    );

    await expect(fetchDocument("https://example.com/edital")).rejects.toThrow(
      "Refusing to fetch a non-public address",
    );
  });

  it("follows public redirects", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { headers: { location: "/novo-edital.pdf" }, status: 301 }),
      )
      .mockResolvedValueOnce(
        new Response("%PDF", { headers: { "content-type": "application/pdf" } }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const document = await fetchDocument("https://example.com/edital");

    expect(document.url).toBe("https://example.com/novo-edital.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails on an error status so the step can retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    await expect(fetchDocument("https://example.com/edital")).rejects.toThrow("status 503");
  });

  // Only a missing intermediate certificate is worth a second request (see issuer-certificates).
  it("passes other connection failures on", async () => {
    const failure = new TypeError("fetch failed", {
      cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
    });

    const fetchMock = vi.fn().mockRejectedValue(failure);

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDocument("https://example.com/edital")).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
