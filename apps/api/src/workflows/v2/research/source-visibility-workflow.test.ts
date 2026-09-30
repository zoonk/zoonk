import { randomUUID } from "node:crypto";
import { findOfficialSources } from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { classifyUploadVisibility } from "@zoonk/ai/tasks/v2/research/upload-visibility";
import { prisma } from "@zoonk/db";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sourceVisibilityWorkflow } from "./source-visibility-workflow";

// Model and search calls are external: tests answer with what they returned for a real notice.
vi.mock("@zoonk/ai/tasks/v2/research/upload-visibility", () => ({
  classifyUploadVisibility: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/research/find-official-sources", () => ({
  findOfficialSources: vi.fn(),
}));

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

async function privateUpload() {
  const user = await userFixture();
  const contentHash = `hash-${randomUUID()}`;

  const source = await sourceFixture({
    contentHash,
    extractedText:
      "EDITAL Nº 1 – TCDF/ANACE, DE 8 DE JULHO DE 2026. O concurso será executado pelo Cebraspe.",
    identityKey: `private:${user.id}:upload:${contentHash}`,
    kind: "upload",
    language: "pt",
    mimeType: "text/plain",
    ownerId: user.id,
    title: "edital",
    url: null,
    visibility: "private",
  });

  return { source, user };
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
      data: {
        documents: [
          {
            documentType: "notice",
            kind: "official",
            publisher: "Cebraspe",
            reason: "Opening notice",
            title: "Edital nº 1 – Abertura – TCDF/ANACE 2026",
            url: "https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/arquivos/edital.pdf",
          },
        ],
        officialFound: true,
        searchCalls: 1,
      },
    });
  });

  it("shares an upload the classifier and a search on the publisher's site agree is public", async () => {
    const { source, user } = await privateUpload();
    classifyAs("public");

    await expect(
      sourceVisibilityWorkflow({ ownerId: user.id, sourceId: source.id }),
    ).resolves.toStrictEqual({ merged: false, sourceId: source.id, status: "shared" });

    // Only the title and publisher are searched, never the document's text.
    expect(vi.mocked(findOfficialSources).mock.calls[0]?.[0].plan.queries).toStrictEqual([
      `${NOTICE_TITLE} Cebraspe`,
    ]);

    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
    ).resolves.toMatchObject({
      ownerId: null,
      title: NOTICE_TITLE,
      url: "https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/arquivos/edital.pdf",
      visibility: "public",
    });
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
      data: { documents: [], officialFound: false, searchCalls: 2 },
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
