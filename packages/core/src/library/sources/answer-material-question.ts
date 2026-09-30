import "server-only";
import { randomUUID } from "node:crypto";
import { answerFromMaterial } from "@zoonk/ai/tasks/v2/material/answer";
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

export type MaterialQuestionResult =
  | { answer: MaterialQuestionAnswer; status: "answered" }
  | { status: "notFound" }
  | Exclude<UsageDecision, { status: "allowed" }>;

/** The learner's own copies of the sources they asked about, in the order they gave them. */
async function findOwnMaterial({ sourceIds, userId }: { sourceIds: string[]; userId: string }) {
  const links = await prisma.learnerSource.findMany({
    select: { source: { select: { extractedText: true, id: true, mimeType: true, title: true } } },
    where: { source: { extractedText: { not: null } }, sourceId: { in: sourceIds }, userId },
  });

  return sourceIds.flatMap((sourceId) => {
    const source = links.find((link) => link.source.id === sourceId)?.source;
    return source?.extractedText ? [{ ...source, text: source.extractedText }] : [];
  });
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

/**
 * Answers a question about the learner's own material (files, links or text they added) from its
 * pages, with the pages the answer came from; a question the material doesn't cover gets a kind
 * "it isn't in your material" instead of a guess. Each question is a tutor message against the
 * learner's allowance and sends "Tutor Asked" after the response.
 */
export async function answerMaterialQuestion(
  input: MaterialQuestionInput,
): Promise<MaterialQuestionResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const material = await findOwnMaterial({ sourceIds: input.sourceIds, userId });

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
