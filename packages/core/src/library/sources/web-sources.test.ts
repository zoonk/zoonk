import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { buildSourceIdentityKey } from "@zoonk/utils/identity-key";
import { Response as PageResponse, fetch } from "undici";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { holdSourceLock, waitForBlockedStatement } from "../../_test-utils/learner-lock";
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

function servePage(html: string) {
  vi.mocked(fetch).mockImplementation(
    async () => new PageResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } }),
  );
}

const NOTICE_TEXT = [
  "Edital nº 1 de 2026. O concurso público destina-se ao provimento de vagas no cargo de",
  "analista. As provas objetivas serão constituídas de itens para julgamento, agrupados por",
  "comandos que deverão ser respeitados. O julgamento de cada item será CERTO ou ERRADO.",
].join(" ");

const SCRIPT_PAGE_TEXT = "É necessário habilitar o javascript para ver esta página corretamente.";

const SOURCE_WRITE = /\bsources\b/u;

const EDITAL = { kind: "official", language: "pt", publisher: null, title: "Edital" } as const;

function noticePage({ questions, token }: { questions: number; token: string }) {
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

    await expect(refreshWebSource(source.id)).resolves.toMatchObject({ status: "unchanged" });
  });

  it("stores a new version, and keeps a law's earlier text until a notice covers the change", async () => {
    servePage(noticePage({ questions: 50, token: "a" }));

    const [exam, law] = await Promise.all([
      storeWebSource({ ...EDITAL, topic: "exam", url: `https://example.gov.br/${randomUUID()}` }),
      storeWebSource({
        ...EDITAL,
        topic: "regulation",
        url: `https://example.gov.br/${randomUUID()}`,
      }),
    ]);

    servePage(noticePage({ questions: 60, token: "d" }));

    await expect(
      Promise.all([refreshWebSource(exam.id), refreshWebSource(law.id)]),
    ).resolves.toMatchObject([{ status: "changed" }, { status: "changed" }]);

    const [storedExam, storedLaw] = await Promise.all(
      [exam.id, law.id].map((id) => prisma.source.findUniqueOrThrow({ where: { id } })),
    );

    expect([storedExam?.extractedText, storedLaw?.extractedText]).toStrictEqual([
      expect.stringContaining("60 questões"),
      expect.stringContaining("60 questões"),
    ]);

    expect(storedExam).toMatchObject({ unnoticedChangedAt: null, unnoticedChanges: null });

    expect(storedLaw).toMatchObject({
      unnoticedChanges: expect.stringContaining("- A prova terá 50 questões."),
      unnoticedFromHash: law.contentHash,
    });
  });

  it("keeps what each of two saves at once changed in a law, whichever saves first", async () => {
    const url = `https://example.gov.br/${randomUUID()}`;
    const law = { ...EDITAL, topic: "regulation" as const, url };
    servePage("<p>Art. 1º A alíquota é de 15%.</p>");
    const source = await storeWebSource(law);
    const held = holdSourceLock(source.id);
    const holder = await held.pid;

    servePage("<p>Art. 1º A alíquota é de 17%.</p>");
    const research = storeWebSource(law);
    await waitForBlockedStatement(holder, SOURCE_WRITE);

    servePage("<p>Art. 1º A alíquota é de 15%.</p><p>Art. 2º Declare até maio.</p>");
    const check = refreshWebSource(source.id);
    await waitForBlockedStatement(holder, SOURCE_WRITE, 2);

    held.release();
    await Promise.all([research, check, held.done]);

    const { unnoticedChanges } = await prisma.source.findUniqueOrThrow({
      where: { id: source.id },
    });

    expect(unnoticedChanges).toContain("+ Art. 1º A alíquota é de 17%.");
    expect(unnoticedChanges).toContain("+ Art. 2º Declare até maio.");
  });

  it("returns null for a source without an address", async () => {
    await expect(refreshWebSource(randomUUID())).resolves.toBeNull();
  });
});
