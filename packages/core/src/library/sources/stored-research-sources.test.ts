import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uniqueWord } from "../identity/_test-utils/identity-mocks";
import { findStoredResearchSources } from "./stored-research-sources";

const DAY_MS = 86_400_000;

const LAW_TEXT = [
  "Art. 1º Esta Lei dispõe sobre o tratamento de dados pessoais, inclusive nos meios digitais,",
  "por pessoa natural ou por pessoa jurídica de direito público ou privado, com o objetivo de",
  "proteger os direitos fundamentais de liberdade e de privacidade e o livre desenvolvimento da",
  "personalidade da pessoa natural.",
].join(" ");

const SCRIPT_PAGE_TEXT = "É necessário habilitar o javascript para ver esta página corretamente.";

function acceptOnly(ids: string[]) {
  return vi.mocked(decideLibraryIdentity).mockImplementation(({ candidates }) => {
    const verdicts = candidates.map((candidate) => ({
      id: candidate.id,
      model: "test/jev",
      probability: ids.includes(candidate.id) ? 0.9 : 0.1,
    }));

    return Promise.resolve({
      match: verdicts.find((verdict) => verdict.probability > 0.5) ?? null,
      verdicts,
    });
  });
}

function storedSource({
  topic,
  word,
  ...attrs
}: Parameters<typeof sourceFixture>[0] & { topic: string; word: string }) {
  return sourceFixture({
    extractedText: LAW_TEXT,
    language: "pt",
    mimeType: "text/html",
    publisher: "Presidência da República",
    structure: { images: 0, pages: 1, topic },
    title: `Lei Geral de Proteção de Dados ${word}`,
    validUntil: new Date(Date.now() + 10 * DAY_MS),
    ...attrs,
  });
}

function request(word: string, topic: "regulation" | "software" | "syllabus" = "regulation") {
  return {
    country: "BR",
    language: "pt",
    name: `LGPD ${word}`,
    publisher: null,
    searchTerms: [`Proteção de Dados ${word}`],
    topic,
  };
}

describe(findStoredResearchSources, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reuses the valid official sources research stored for the same topic", async () => {
    const word = uniqueWord();

    const [lawText, guide, summary] = await Promise.all([
      storedSource({ topic: "regulation", word }),
      storedSource({ title: `Guia da LGPD ${word}`, topic: "regulation", word }),
      storedSource({ title: `Resumo da LGPD ${word}`, topic: "regulation", word }),
    ]);

    const decision = acceptOnly([lawText.id, guide.id]);

    const found = await findStoredResearchSources(request(word));

    expect(found.toSorted()).toStrictEqual([lawText.id, guide.id].toSorted());
    expect(found).not.toContain(summary.id);

    expect(decision).toHaveBeenCalledOnce();
    expect(decision.mock.calls[0]?.[0].candidates).toHaveLength(3);

    expect(decision.mock.calls[0]?.[0].subject).toMatchObject({
      item: {
        description: "The current official text of this law or regulation (country: BR).",
        title: `LGPD ${word}`,
      },
      kind: "researchSource",
      language: "pt",
    });
  });

  it("never offers expired, private, secondary or other-topic sources to the decision", async () => {
    const word = uniqueWord();

    await Promise.all([
      storedSource({ topic: "regulation", validUntil: new Date(Date.now() - DAY_MS), word }),
      storedSource({ ownerId: null, topic: "regulation", visibility: "private", word }),
      storedSource({ kind: "secondary", topic: "regulation", word }),
      storedSource({ topic: "software", word }),
      storedSource({ language: "en", topic: "regulation", word }),
    ]);

    await expect(findStoredResearchSources(request(word))).resolves.toStrictEqual([]);
    expect(decideLibraryIdentity).not.toHaveBeenCalled();
  });

  it("never offers a page that stored no text, but offers a PDF, which models read as a file", async () => {
    const word = uniqueWord();

    const [pdf] = await Promise.all([
      storedSource({ extractedText: null, mimeType: "application/pdf", topic: "regulation", word }),
      storedSource({ extractedText: SCRIPT_PAGE_TEXT, topic: "regulation", word }),
      storedSource({ extractedText: null, topic: "regulation", word }),
    ]);

    const decision = acceptOnly([pdf.id]);

    await expect(findStoredResearchSources(request(word))).resolves.toStrictEqual([pdf.id]);
    expect(decision).toHaveBeenCalledOnce();
  });

  it("finds a subject's stored reference syllabi and nothing when the decision rejects them", async () => {
    const word = uniqueWord();

    const syllabus = await storedSource({
      publisher: "USP",
      title: `Ementa LGPD ${word}`,
      topic: "syllabus",
      validUntil: new Date(Date.now() + 300 * DAY_MS),
      word,
    });

    acceptOnly([syllabus.id]);

    await expect(findStoredResearchSources(request(word, "syllabus"))).resolves.toStrictEqual([
      syllabus.id,
    ]);

    acceptOnly([]);
    await expect(findStoredResearchSources(request(word, "syllabus"))).resolves.toStrictEqual([]);
  });

  it("hands the decision the sources it found, best first", async () => {
    const [broad, specific] = [uniqueWord(), uniqueWord()];
    const partial = await storedSource({ title: `Lei ${broad}`, topic: "regulation", word: broad });

    const target = await storedSource({
      title: `Lei ${broad} ${specific}`,
      topic: "regulation",
      word: broad,
    });

    const decision = acceptOnly([target.id]);

    const found = await findStoredResearchSources({
      ...request(broad),
      name: broad,
      searchTerms: [specific],
    });

    expect(found).toStrictEqual([target.id]);

    expect(decision.mock.calls[0]?.[0].candidates.map((candidate) => candidate.id)).toStrictEqual([
      target.id,
      partial.id,
    ]);
  });
});
