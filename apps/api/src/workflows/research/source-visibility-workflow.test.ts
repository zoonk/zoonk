import { createHash, randomUUID } from "node:crypto";
import {
  type FoundSourceDocument,
  findOfficialSources,
} from "@zoonk/ai/tasks/research/find-official-sources";
import { classifyUploadVisibility } from "@zoonk/ai/tasks/research/upload-visibility";
import { prisma } from "@zoonk/db";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { Response as PageResponse, fetch } from "undici";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sourceVisibilityWorkflow } from "./source-visibility-workflow";

const TASK_RESULT = {
  provenance: {
    costUsd: 0,
    generatedAt: "2026-09-26T12:00:00.000Z",
    latencyMs: 1,
    model: "openai/gpt-6-luna",
    promptVersion: "v1",
    provider: "openai",
    requestedModel: "openai/gpt-6-luna",
    runId: "recorded",
    usage: {},
  },
  systemPrompt: "",
  usage: {} as never,
  userPrompt: "",
};

const NOTICE_TITLE = "Edital nº 1 – TCDF/ANACE, de 8 de julho de 2026";

const NOTICE_URL = "https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/arquivos/edital.pdf";

function officialDocument(document: Partial<FoundSourceDocument>): FoundSourceDocument {
  return {
    documentType: "notice",
    kind: "official",
    publisher: "Cebraspe",
    reason: "Opening notice",
    title: "Edital nº 1 – Abertura – TCDF/ANACE 2026",
    url: NOTICE_URL,
    ...document,
  };
}

function servePages(pages: Record<string, string>) {
  vi.mocked(fetch).mockImplementation(async (url) => {
    const page = typeof url === "string" ? pages[url] : undefined;

    return page === undefined
      ? new PageResponse("Not found", { status: 404 })
      : new PageResponse(page, { headers: { "content-type": "text/plain" } });
  });
}

async function privateUpload(
  text = `EDITAL Nº 1 – TCDF/ANACE, DE 8 DE JULHO DE 2026. ${randomUUID()}`,
) {
  const user = await userFixture();
  const contentHash = createHash("sha256").update(text).digest("hex");

  const source = await sourceFixture({
    contentHash,
    extractedText: text,
    identityKey: `private:${user.id}:upload:${contentHash}`,
    kind: "upload",
    language: "pt",
    mimeType: "text/plain",
    ownerId: user.id,
    title: "edital",
    url: null,
    visibility: "private",
  });

  return { source, text, user };
}

function classifyAs(visibility: "public" | "private") {
  vi.mocked(classifyUploadVisibility).mockResolvedValue({
    ...TASK_RESULT,
    data: {
      documentKind: visibility === "public" ? "examNotice" : "classMaterial",
      language: "pt",
      publisher: "Cebraspe",
      title: NOTICE_TITLE,
      visibility,
    },
  });
}

describe(sourceVisibilityWorkflow, () => {
  beforeEach(() => {
    vi.mocked(findOfficialSources).mockResolvedValue({
      ...TASK_RESULT,
      data: { board: null, documents: [officialDocument({})], officialFound: true, searchCalls: 1 },
    });
  });

  it("shares an upload the classifier calls public when the publisher's copy reads the same", async () => {
    const { source, text, user } = await privateUpload();
    classifyAs("public");
    servePages({ [NOTICE_URL]: text });

    await expect(
      sourceVisibilityWorkflow({ ownerId: user.id, sourceId: source.id }),
    ).resolves.toStrictEqual({ merged: false, sourceId: source.id, status: "shared" });

    expect(vi.mocked(findOfficialSources).mock.calls[0]?.[0].plan.queries).toStrictEqual([
      `${NOTICE_TITLE} Cebraspe`,
    ]);

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({
      ownerId: null,
      title: NOTICE_TITLE,
      url: NOTICE_URL,
      visibility: "public",
    });
  });

  it("keeps an edited notice private though the publisher's site has a document with its title", async () => {
    const official = `EDITAL Nº 1 – TCDF/ANACE. As provas serão em 8 de julho. ${randomUUID()}`;
    const { source, user } = await privateUpload(official.replace("8 de julho", "9 de agosto"));
    classifyAs("public");
    servePages({ [NOTICE_URL]: official });

    await expect(
      sourceVisibilityWorkflow({ ownerId: user.id, sourceId: source.id }),
    ).resolves.toStrictEqual({ status: "private" });

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ ownerId: user.id, visibility: "private" });
  });

  it("shares the publisher's document that reads the same when several carry the title", async () => {
    const { source, text, user } = await privateUpload();
    const correctionUrl = "https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/retificacao.pdf";
    const missingUrl = "https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/removido.pdf";
    classifyAs("public");

    vi.mocked(findOfficialSources).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        board: null,
        documents: [
          officialDocument({
            title: "Edital nº 2 – Retificação – TCDF/ANACE 2026",
            url: correctionUrl,
          }),
          officialDocument({ url: missingUrl }),
          officialDocument({}),
        ],
        officialFound: true,
        searchCalls: 1,
      },
    });

    servePages({
      [NOTICE_URL]: text,
      [correctionUrl]: `EDITAL Nº 2 – RETIFICAÇÃO. ${randomUUID()}`,
    });

    await expect(
      sourceVisibilityWorkflow({ ownerId: user.id, sourceId: source.id }),
    ).resolves.toStrictEqual({ merged: false, sourceId: source.id, status: "shared" });

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ url: NOTICE_URL, visibility: "public" });
  });

  it("keeps an upload private without searching when the classifier says so", async () => {
    const { source, user } = await privateUpload();
    classifyAs("private");

    await expect(
      sourceVisibilityWorkflow({ ownerId: user.id, sourceId: source.id }),
    ).resolves.toStrictEqual({ status: "private" });

    expect(findOfficialSources).not.toHaveBeenCalled();

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ visibility: "private" });
  });

  it("keeps an upload private when the search can't find it on the publisher's site", async () => {
    const { source, user } = await privateUpload();
    classifyAs("public");

    vi.mocked(findOfficialSources).mockResolvedValue({
      ...TASK_RESULT,
      data: { board: null, documents: [], officialFound: false, searchCalls: 2 },
    });

    await expect(
      sourceVisibilityWorkflow({ ownerId: user.id, sourceId: source.id }),
    ).resolves.toStrictEqual({ status: "private" });

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ ownerId: user.id });
  });

  it("keeps an upload private when only an unofficial copy carries its title", async () => {
    const { source, user } = await privateUpload();
    classifyAs("public");

    vi.mocked(findOfficialSources).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        board: null,
        documents: [
          {
            documentType: "notice",
            kind: "secondary",
            publisher: "Blog de concursos",
            reason: "A copy of the notice",
            title: NOTICE_TITLE,
            url: "https://blog.example.com/edital-tcdf-2026.pdf",
          },
        ],
        officialFound: false,
        searchCalls: 1,
      },
    });

    await expect(
      sourceVisibilityWorkflow({ ownerId: user.id, sourceId: source.id }),
    ).resolves.toStrictEqual({ status: "private" });

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({ ownerId: user.id, visibility: "private" });
  });

  it("classifies nothing for an upload that no longer exists", async () => {
    const user = await userFixture();

    await expect(
      sourceVisibilityWorkflow({ ownerId: user.id, sourceId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "missing" });

    expect(classifyUploadVisibility).not.toHaveBeenCalled();
  });
});
