import "server-only";
import { randomUUID } from "node:crypto";
import { answerFromMaterial } from "@zoonk/ai/tasks/material/answer";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { claimUsage } from "../../entitlements/claim-usage";
import { type UsageDecision } from "../../entitlements/contract";
import { getSession } from "../../users/get-session";
import {
  type MaterialPage,
  findMaterialPage,
  formatMaterialPages,
  selectMaterialPages,
  toMaterialPages,
} from "./material-pages";
import {
  type MaterialCitation,
  type MaterialQuestionAnswer,
  type MaterialQuestionInput,
} from "./material-question-contract";
import { findOwnSources } from "./own-sources";
import { materialSourceFields, toReadableMaterial } from "./readable-material";

export type MaterialQuestionResult =
  | { answer: MaterialQuestionAnswer; status: "answered" }
  | { status: "notFound" }
  | { status: "materialReading" }
  | Exclude<UsageDecision, { status: "allowed" }>;

async function findOwnMaterial({ sourceIds, userId }: { sourceIds: string[]; userId: string }) {
  const { resolved } = await findOwnSources({ sourceIds, userId });

  const sources = await prisma.source.findMany({
    select: materialSourceFields,
    where: { id: { in: resolved } },
  });

  return resolved.flatMap((sourceId) => sources.find((source) => source.id === sourceId) ?? []);
}

function toCitations({
  pages,
  refs,
}: {
  pages: readonly MaterialPage[];
  refs: readonly string[];
}): MaterialCitation[] {
  return refs.flatMap((ref) => {
    const page = findMaterialPage({ pages, ref });
    return page ? [{ page: page.page, title: page.title, unit: page.unit }] : [];
  });
}

export async function answerMaterialQuestion(
  input: MaterialQuestionInput,
): Promise<MaterialQuestionResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const sources = await findOwnMaterial({ sourceIds: input.sourceIds, userId });

  if (sources.some((source) => source.readState === "owed")) {
    return { status: "materialReading" };
  }

  const material = toReadableMaterial(sources);

  if (material.length === 0) {
    return { status: "notFound" };
  }

  const decision = await claimUsage({ kind: "tutorMessage", targetId: randomUUID() });

  if (decision.status !== "allowed") {
    return decision;
  }

  after(() =>
    trackLearnerEvents({
      events: [{ name: "Tutor Asked", properties: { scope: "material" } }],
      userId,
    }),
  );

  const pages = selectMaterialPages({ pages: toMaterialPages(material), query: input.question });

  const { data } = await answerFromMaterial({
    analytics: { contentScope: "personal", distinctId: userId },
    language: input.language,
    material: formatMaterialPages(pages),
    question: input.question,
  });

  const citations = toCitations({ pages, refs: data.refs });

  return {
    answer: { answer: data.answer, citations, found: data.found && citations.length > 0 },
    status: "answered",
  };
}
