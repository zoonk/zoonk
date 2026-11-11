import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { prisma } from "@zoonk/db";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDecision, uniqueWord } from "../identity/_test-utils/identity-mocks";
import { canLookUpLaw, getLawLookupToken, isOfficialSite } from "./law-identity";
import { findStoredLawSource, isLawSource, readLawLookup, recordLawLookup } from "./law-sources";
import { SOURCE_READ_VERSION } from "./source-contract";

const DAY_MS = 86_400_000;

const LAW_OPENING =
  "LEI Nº 12.813, DE 16 DE MAIO DE 2013. Dispõe sobre o conflito de interesses no exercício de cargo ou emprego do Poder Executivo federal.";

const FIRST_ARTICLE =
  "Art. 1º As situações que configuram conflito de interesses envolvendo ocupantes de cargo ou emprego no âmbito do Poder Executivo federal regem-se pelo disposto nesta Lei.";

function lawRequest(word: string) {
  return {
    country: "BR",
    language: "pt",
    name: word,
    officialDomains: ["planalto.gov.br", "camara.leg.br"],
    searchTerms: [word],
  };
}

function storedLaw({
  host = "www.planalto.gov.br",
  word,
  ...attrs
}: Parameters<typeof sourceFixture>[0] & { host?: string; word: string }) {
  return sourceFixture({
    extractedText: `${LAW_OPENING}\n${FIRST_ARTICLE}`,
    language: "pt",
    mimeType: "text/html",
    readVersion: SOURCE_READ_VERSION,
    structure: { images: 0, pages: null, topic: "regulation" },
    title: `Lei nº 12.813 ${word}`,
    url: `https://${host}/ccivil_03/lei/${word}.htm`,
    validUntil: new Date(Date.now() + 10 * DAY_MS),
    ...attrs,
  });
}

describe(readLawLookup, () => {
  it("answers for 30 days, found or not, and counts a law's names written apart as one", async () => {
    const law = lawRequest(uniqueWord());
    const source = await storedLaw({ word: uniqueWord() });

    await expect(readLawLookup(law)).resolves.toBeNull();

    await recordLawLookup({ law, sourceId: null });
    await expect(readLawLookup(law)).resolves.toStrictEqual({ sourceId: null });

    await recordLawLookup({
      law: { ...law, name: ` ${law.name.toUpperCase()}.` },
      sourceId: source.id,
    });

    await expect(readLawLookup(law)).resolves.toStrictEqual({ sourceId: source.id });

    await prisma.lawLookup.updateMany({
      data: { checkedAt: new Date(Date.now() - 31 * DAY_MS) },
      where: { sourceId: source.id },
    });

    await expect(readLawLookup(law)).resolves.toBeNull();
  });
});

describe(recordLawLookup, () => {
  it("names a law stored under its page's file name, and keeps a name already given", async () => {
    const law = lawRequest(uniqueWord());

    const [fileNamed, named] = await Promise.all([
      storedLaw({ title: "L9784", word: uniqueWord() }),
      storedLaw({ title: "Código de Defesa do Consumidor", word: uniqueWord() }),
    ]);

    await recordLawLookup({ law, sourceId: fileNamed.id });
    await recordLawLookup({ law, sourceId: named.id });

    const titles = await prisma.source.findMany({
      orderBy: { title: "asc" },
      select: { title: true },
      where: { id: { in: [fileNamed.id, named.id] } },
    });

    expect(titles.map((source) => source.title).toSorted()).toStrictEqual(
      ["Código de Defesa do Consumidor", law.name].toSorted(),
    );
  });
});

describe(findStoredLawSource, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reuses a stored official copy, judged from its opening text", async () => {
    const word = uniqueWord();
    const law = await storedLaw({ word });
    const decision = mockDecision(law.id);

    await expect(findStoredLawSource(lawRequest(word))).resolves.toBe(law.id);

    expect(decision.mock.calls[0]?.[0].candidates).toStrictEqual([
      {
        id: law.id,
        item: {
          opening: `${LAW_OPENING} ${FIRST_ARTICLE}`,
          publisher: null,
          title: law.title,
          url: law.url,
        },
      },
    ]);
  });

  it("never offers a copy off the law's official sites or one whose text was cut", async () => {
    const word = uniqueWord();

    const [mirror, cut] = await Promise.all([
      storedLaw({ host: "www.jusbrasil.com.br", word }),
      storedLaw({ extractedText: "Art. 1º ".padEnd(2_000_000, "x"), word }),
    ]);

    mockDecision(mirror.id);

    await expect(findStoredLawSource(lawRequest(word))).resolves.toBeNull();
    expect(decideLibraryIdentity).not.toHaveBeenCalled();
    expect(cut.id).not.toBe(mirror.id);
  });

  it("never offers a copy an older reader stored, which cut laws short and kept revoked wording", async () => {
    const word = uniqueWord();
    const law = await storedLaw({ readVersion: 0, word });
    mockDecision(law.id);

    await expect(findStoredLawSource(lawRequest(word))).resolves.toBeNull();
    expect(decideLibraryIdentity).not.toHaveBeenCalled();
  });
});

describe(isLawSource, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("accepts a document just stored only when the judge reads it as the law", async () => {
    const word = uniqueWord();
    const law = await storedLaw({ host: "www2.camara.leg.br", word });

    mockDecision(law.id);
    await expect(isLawSource({ law: lawRequest(word), sourceId: law.id })).resolves.toBe(true);

    mockDecision(null);
    await expect(isLawSource({ law: lawRequest(word), sourceId: law.id })).resolves.toBe(false);
  });
});

describe(isOfficialSite, () => {
  it("takes the official domains and their subdomains only", () => {
    const domains = ["planalto.gov.br", "camara.leg.br"];

    expect(
      [
        "https://www.planalto.gov.br/ccivil_03/lei.htm",
        "https://www4.planalto.gov.br/legislacao",
        "https://www2.camara.leg.br/legin/fed/lei/2013/lei.html",
        "https://planalto.gov.br.example.com/lei.htm",
        "https://fakeplanalto.gov.br/lei.htm",
      ].map((url) => isOfficialSite({ domains, url })),
    ).toStrictEqual([true, true, true, false, false]);
  });
});

describe(canLookUpLaw, () => {
  it("looks up only a law with a country code, the text's language and its official sites", () => {
    const law = lawRequest(uniqueWord());

    expect(
      [
        law,
        { ...law, language: "pt-BR" },
        { ...law, country: "BRA" },
        { ...law, country: "" },
        { ...law, language: "Portuguese" },
        { ...law, name: " . " },
        { ...law, officialDomains: [] },
      ].map((request) => canLookUpLaw(request)),
    ).toStrictEqual([true, true, false, false, false, false, false]);
  });
});

describe(getLawLookupToken, () => {
  it("gives a law's name written apart one run", () => {
    const law = { country: "BR", language: "pt", name: "Lei nº 12.813/2013" };

    expect(getLawLookupToken({ ...law, name: "LEI Nº 12.813 / 2013" })).toBe(
      getLawLookupToken(law),
    );

    expect(getLawLookupToken({ ...law, country: "PT" })).not.toBe(getLawLookupToken(law));
  });
});
