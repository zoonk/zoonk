import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { buildSourceIdentityKey } from "@zoonk/utils/identity-key";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCandidateIds,
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../identity/_test-utils/identity-mocks";
import {
  findWebSourceCopy,
  listReadableSourceIds,
  refreshWebSource,
  storeWebSource,
} from "./web-sources";

// Model calls are external: identity search's terms and reuse decisions are mocked.
vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

// The web is an external boundary: each test serves its own pages from memory.
function servePage(html: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
      ),
    ),
  );
}

/** A notice's text as research stores it: long enough for a model to read the exam from. */
const NOTICE_TEXT = [
  "Edital nº 1 de 2026. O concurso público destina-se ao provimento de vagas no cargo de",
  "analista. As provas objetivas serão constituídas de itens para julgamento, agrupados por",
  "comandos que deverão ser respeitados. O julgamento de cada item será CERTO ou ERRADO.",
].join(" ");

/** What a page that builds its text with JavaScript stores. */
const SCRIPT_PAGE_TEXT = "É necessário habilitar o javascript para ver esta página corretamente.";

function noticePage({ questions, token }: { questions: number; token: string }) {
  // The token changes on every fetch, like CSRF tokens do, and must not count as a change.
  return `<html><body><input type="hidden" value="${token}"><h1>Edital 2026</h1><p>A prova terá ${questions} questões.</p></body></html>`;
}

describe(findWebSourceCopy, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("finds the Library's copy of a document published at another address", async () => {
    const word = uniqueWord();

    const copy = await sourceFixture({
      extractedText: NOTICE_TEXT,
      language: "pt",
      mimeType: "text/html",
      publisher: "Cebraspe",
      title: `Edital ${word}`,
      visibility: "public",
    });

    mockSearchTerms([word]);
    const decision = mockDecision(copy.id);

    const copyId = await findWebSourceCopy({
      language: "pt",
      publisher: "Cebraspe",
      title: `${word} edital`,
      url: `https://cdn.cebraspe.org.br/${randomUUID()}.pdf`,
    });

    expect(copyId).toBe(copy.id);
    expect(getCandidateIds(decision)).toContain(copy.id);
  });

  it("never takes a stored page without text as the copy, so the document found is fetched", async () => {
    const word = uniqueWord();

    await sourceFixture({
      extractedText: SCRIPT_PAGE_TEXT,
      language: "pt",
      mimeType: "text/html",
      publisher: "Cebraspe",
      title: `Edital ${word}`,
      visibility: "public",
    });

    mockSearchTerms([word]);
    const decision = mockDecision(null);

    const copyId = await findWebSourceCopy({
      language: "pt",
      publisher: "Cebraspe",
      title: `${word} edital`,
      url: `https://cdn.cebraspe.org.br/${randomUUID()}.pdf`,
    });

    expect(copyId).toBeNull();
    expect(decision).not.toHaveBeenCalled();
  });

  it("finds nothing when the reuse decision says no stored document is the same", async () => {
    const word = uniqueWord();

    await sourceFixture({ language: "pt", title: `Edital ${word} 2024`, visibility: "public" });
    mockSearchTerms([word]);
    mockDecision(null);

    const copyId = await findWebSourceCopy({
      language: "pt",
      publisher: "Cebraspe",
      title: "Edital 2026",
      url: `https://www.cebraspe.org.br/${randomUUID()}`,
    });

    expect(copyId).toBeNull();
  });

  it("leaves an address the Library already holds to be fetched again, so a republished notice is read fresh", async () => {
    const url = `https://www.cebraspe.org.br/concursos/${randomUUID()}`;

    await sourceFixture({
      identityKey: buildSourceIdentityKey({ contentHash: null, url }),
      language: "pt",
      url,
    });

    const searchSpy = mockSearchTerms([]);

    await expect(
      findWebSourceCopy({ language: "pt", publisher: null, title: "Edital", url }),
    ).resolves.toBeNull();

    expect(searchSpy).not.toHaveBeenCalled();
  });
});

describe(listReadableSourceIds, () => {
  it("keeps the sources a model can read, in the order given", async () => {
    const [notice, scriptPage, scannedPdf, empty] = await Promise.all([
      sourceFixture({ extractedText: NOTICE_TEXT, mimeType: "text/html" }),
      sourceFixture({ extractedText: SCRIPT_PAGE_TEXT, mimeType: "text/html" }),
      sourceFixture({ extractedText: null, mimeType: "application/pdf" }),
      sourceFixture({ extractedText: null, mimeType: "text/html" }),
    ]);

    await expect(
      listReadableSourceIds([scannedPdf.id, scriptPage.id, empty.id, notice.id, randomUUID()]),
    ).resolves.toStrictEqual([scannedPdf.id, notice.id]);

    await expect(listReadableSourceIds([])).resolves.toStrictEqual([]);
  });
});

describe(storeWebSource, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores a page once per canonical address with its text, validity and the board's reuse policy", async () => {
    const url = `https://www.cebraspe.org.br/concursos/${randomUUID()}/`;
    servePage(noticePage({ questions: 50, token: "a" }));

    const source = await storeWebSource({
      kind: "official",
      language: "pt",
      publisher: "Cebraspe",
      title: "Edital",
      topic: "regulation",
      url: `${url}#inscricoes`,
    });

    const stored = await prisma.source.findUniqueOrThrow({ where: { id: source.id } });

    expect(stored).toMatchObject({
      identityKey: url.replace("https://www.", "").replace(/\/$/u, ""),
      kind: "official",
      mimeType: "text/html",
      url,
      visibility: "public",
    });

    expect(stored.extractedText).toContain("A prova terá 50 questões.");
    expect(stored.reusePolicy).toMatchObject({ pastQuestions: "allowedWithCitation" });
    expect(stored.validUntil?.getTime()).toBeGreaterThan(Date.now());

    servePage(noticePage({ questions: 50, token: "b" }));

    const again = await storeWebSource({
      kind: "official",
      language: "pt",
      publisher: "Cebraspe",
      title: "Edital",
      topic: "regulation",
      url,
    });

    expect(again.id).toBe(source.id);
    expect(again.contentHash).toBe(source.contentHash);
  });
});

describe(refreshWebSource, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports unchanged when only the page's markup changed", async () => {
    const url = `https://example.gov.br/${randomUUID()}`;
    servePage(noticePage({ questions: 50, token: "a" }));

    const source = await storeWebSource({
      kind: "official",
      language: "pt",
      publisher: null,
      title: "Edital",
      topic: "exam",
      url,
    });

    servePage(noticePage({ questions: 50, token: "c" }));

    await expect(refreshWebSource(source.id)).resolves.toMatchObject({
      change: null,
      status: "unchanged",
    });
  });

  it("stores a new version and describes what changed", async () => {
    const url = `https://example.gov.br/${randomUUID()}`;
    servePage(noticePage({ questions: 50, token: "a" }));

    const source = await storeWebSource({
      kind: "official",
      language: "pt",
      publisher: null,
      title: "Edital",
      topic: "exam",
      url,
    });

    servePage(noticePage({ questions: 60, token: "d" }));

    const refresh = await refreshWebSource(source.id);

    expect(refresh).toMatchObject({
      change: expect.stringContaining("+ A prova terá 60 questões."),
      previousHash: source.contentHash,
      status: "changed",
    });

    const stored = await prisma.source.findUniqueOrThrow({ where: { id: source.id } });

    expect(stored.extractedText).toContain("60 questões");
    expect(stored.contentHash).not.toBe(source.contentHash);
  });

  it("returns null for a source without an address", async () => {
    await expect(refreshWebSource(randomUUID())).resolves.toBeNull();
  });
});
