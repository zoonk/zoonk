import { randomUUID } from "node:crypto";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import {
  type FoundSourceDocument,
  findOfficialSources,
} from "@zoonk/ai/tasks/research/find-official-sources";
import { readLawLookup, recordLawLookup } from "@zoonk/core/library/sources/laws";
import { prisma } from "@zoonk/db";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { Response as PageResponse, fetch } from "undici";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { taskResult } from "../_test-utils/recorded-outputs";
import { type LawToLookUp, lawSourceWorkflow } from "./law-source-workflow";

const LAW_TEXT = [
  "LEI Nº 12.813, DE 16 DE MAIO DE 2013",
  "Dispõe sobre o conflito de interesses no exercício de cargo ou emprego do Poder Executivo federal.",
  "Art. 1º As situações que configuram conflito de interesses envolvendo ocupantes de cargo ou emprego no âmbito do Poder Executivo federal regem-se pelo disposto nesta Lei.",
  "Art. 4º O ocupante de cargo ou emprego no Poder Executivo federal deve agir de modo a prevenir ou a impedir possível conflito de interesses.",
  "Art. 5º Configura conflito de interesses no exercício de cargo ou emprego no âmbito do Poder Executivo federal:",
].join("\n");

function lawToLookUp(): LawToLookUp {
  const word = `zq${randomUUID().replaceAll("-", "").slice(0, 10)}`;

  return {
    country: "BR",
    language: "pt",
    name: `Lei ${word}`,
    officialDomains: ["planalto.gov.br", "camara.leg.br"],
    queries: [`lei ${word} texto compilado`],
    searchTerms: [word],
  };
}

function lawAddress(document: Partial<FoundSourceDocument>): FoundSourceDocument {
  return {
    documentType: "law",
    kind: "official",
    publisher: "Presidência da República",
    reason: "The law's consolidated text",
    title: `Lei nº 12.813 ${randomUUID()}`,
    url: `https://www.planalto.gov.br/ccivil_03/${randomUUID()}.htm`,
    ...document,
  };
}

function findAddresses(documents: FoundSourceDocument[]) {
  vi.mocked(findOfficialSources).mockResolvedValue(
    taskResult({ board: null, documents, officialFound: true, searchCalls: 1 }),
  );
}

function servePages(pages: Record<string, string>) {
  vi.mocked(fetch).mockImplementation(async (url) => {
    const page = typeof url === "string" ? pages[url] : undefined;

    return page === undefined
      ? new PageResponse("Forbidden", { status: 403 })
      : new PageResponse(page, { headers: { "content-type": "text/plain" } });
  });
}

function judgeAsLaw(isLaw: (url: string | null | undefined) => boolean) {
  vi.mocked(decideLibraryIdentity).mockImplementation(async ({ candidates }) => {
    const verdicts = candidates.map((candidate) => ({
      id: candidate.id,
      model: "test/jev",
      probability: isLaw(candidate.item.url) ? 0.9 : 0.1,
    }));

    return { match: verdicts.find((verdict) => verdict.probability > 0.5) ?? null, verdicts };
  });
}

function fetchedUrls(): string[] {
  return vi.mocked(fetch).mock.calls.flatMap(([url]) => (typeof url === "string" ? [url] : []));
}

describe(lawSourceWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateSearchTerms).mockImplementation(async ({ subjects }) =>
      taskResult({ subjects: subjects.map(() => ({ terms: [randomUUID().slice(0, 8)] })) }),
    );
  });

  it("keeps the whole official text from the first address that gives it and reads as the law", async () => {
    const law = lawToLookUp();
    const refused = lawAddress({});

    const camara = lawAddress({
      title: "L12813",
      url: `https://www2.camara.leg.br/legin/${randomUUID()}.html`,
    });

    const mirror = lawAddress({ url: `https://www.jusbrasil.com.br/${randomUUID()}` });

    const summary = lawAddress({
      kind: "secondary",
      url: `https://www.planalto.gov.br/${randomUUID()}`,
    });

    findAddresses([refused, mirror, summary, camara]);
    servePages({ [camara.url]: LAW_TEXT, [mirror.url]: LAW_TEXT, [summary.url]: LAW_TEXT });
    judgeAsLaw((url) => url === camara.url);

    await lawSourceWorkflow({ law });

    const lookup = await readLawLookup(law);
    const source = await prisma.source.findUniqueOrThrow({ where: { id: lookup?.sourceId ?? "" } });

    expect(source).toMatchObject({
      extractedText: LAW_TEXT,
      kind: "official",
      title: law.name,
      url: camara.url,
    });

    expect(fetchedUrls()).toStrictEqual([refused.url, camara.url]);
  });

  it("downloads an official address even when the Library holds a mirror of the same law", async () => {
    const law = lawToLookUp();
    const word = `zq${randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const official = lawAddress({ title: `Lei nº 12.813 ${word}` });

    const mirror = await sourceFixture({
      extractedText: LAW_TEXT,
      language: "pt",
      structure: { images: 0, pages: null, topic: "regulation" },
      title: official.title,
      url: `https://www.jusbrasil.com.br/${randomUUID()}`,
    });

    vi.mocked(generateSearchTerms).mockResolvedValue(taskResult({ subjects: [{ terms: [word] }] }));

    findAddresses([official]);
    servePages({ [official.url]: LAW_TEXT });
    judgeAsLaw((url) => url === official.url || url === mirror.url);

    await lawSourceWorkflow({ law });

    const lookup = await readLawLookup(law);
    const source = await prisma.source.findUniqueOrThrow({ where: { id: lookup?.sourceId ?? "" } });

    expect(source.url).toBe(official.url);
  });

  it("records that no text was found when the judge reads none of the addresses as the law", async () => {
    const law = lawToLookUp();
    const index = lawAddress({});

    findAddresses([index]);
    servePages({ [index.url]: `Legislação. Veja: ${LAW_TEXT}` });
    judgeAsLaw(() => false);

    await lawSourceWorkflow({ law });

    await expect(readLawLookup(law)).resolves.toStrictEqual({ sourceId: null });
  });

  it("answers from a lookup made in the last 30 days without searching", async () => {
    const law = lawToLookUp();
    await recordLawLookup({ law, sourceId: null });

    await lawSourceWorkflow({ law });

    expect(findOfficialSources).not.toHaveBeenCalled();
    expect(decideLibraryIdentity).not.toHaveBeenCalled();
  });

  it("reuses a stored copy of the law after one judgment, without searching", async () => {
    const law = lawToLookUp();

    const stored = await sourceFixture({
      extractedText: LAW_TEXT,
      language: "pt",
      readVersion: 1,
      structure: { images: 0, pages: null, topic: "regulation" },
      title: `Lei nº 12.813 ${law.searchTerms[0]}`,
      url: `https://www.planalto.gov.br/ccivil_03/${randomUUID()}.htm`,
      validUntil: new Date(Date.now() + 86_400_000),
    });

    judgeAsLaw((url) => url === stored.url);

    await lawSourceWorkflow({ law });

    await expect(readLawLookup(law)).resolves.toStrictEqual({ sourceId: stored.id });
    expect(decideLibraryIdentity).toHaveBeenCalledOnce();
    expect(findOfficialSources).not.toHaveBeenCalled();
  });

  it("records the law as unavailable when its search still fails after its retries", async () => {
    const law = lawToLookUp();
    vi.mocked(findOfficialSources).mockRejectedValue(new Error("Search provider unavailable"));

    await expect(lawSourceWorkflow({ law })).rejects.toThrow("Search provider unavailable");
    await expect(readLawLookup(law)).resolves.toStrictEqual({ sourceId: null });
  });
});
