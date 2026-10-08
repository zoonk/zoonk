import "server-only";
import {
  type PastQuestion,
  type PastQuestionFormat,
} from "@zoonk/ai/tasks/v2/items/past-questions";
import { type Source, prisma, sql } from "@zoonk/db";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { getExamChoiceFormat } from "../exams/exam-choice-format";
import { readBlueprintContent } from "../exams/save-exam-blueprint";
import { getKnownReusePolicy } from "../sources/reuse-policy";
import { reusePolicySchema } from "../sources/source-contract";
import { checkItem } from "./item-checks";
import { toStoredItem } from "./item-content";
import { checkPastQuestion } from "./past-question-checks";

/** The goal's skills a paper's questions are matched to; more makes the prompt long for little. */
const MAX_PAPER_SKILLS = 40;

/** Namespaces the per-paper import lock so it never collides with other advisory locks. */
const IMPORT_LOCK_NAMESPACE = 51_880;

/** One allowed past paper of an exam, and what its questions are copied into. */
export type PastPaperTarget = {
  /** The exam as the paper names it, such as "Enem" or "Polícia Federal, Agente". */
  exam: string;
  examBlueprintId: string;
  format: PastQuestionFormat;
  language: string;
  optionCount: number | null;
  paper: { id: string; title: string };
  skills: { description: string; id: string; name: string }[];
};

type PolicySource = Pick<Source, "publisher" | "reusePolicy" | "url">;

function readPolicies(source: PolicySource) {
  return [
    reusePolicySchema.safeParse(source.reusePolicy).data,
    getKnownReusePolicy({ publisher: source.publisher, url: source.url }),
  ].flatMap((policy) => (policy ? [policy.pastQuestions] : []));
}

/**
 * Whether a paper's questions may be copied: its stored terms or its board's checked policy allow
 * it with the source cited (Enem, Brazilian public-service boards), and nothing says otherwise
 * (College Board never). Unclear terms mean original questions only.
 */
function canQuotePastQuestions(source: PolicySource): boolean {
  const policies = readPolicies(source);
  return policies.includes("allowedWithCitation") && !policies.includes("notAllowed");
}

function forbidsQuoting(source: PolicySource | null): boolean {
  return source !== null && readPolicies(source).includes("notAllowed");
}

async function loadGoalSkills(graph: unknown): Promise<PastPaperTarget["skills"]> {
  const skillIds = parsePlanGraph(graph)
    .skills.map((skill) => skill.skillId)
    .slice(0, MAX_PAPER_SKILLS);

  const skills = await prisma.skill.findMany({
    select: { description: true, id: true, name: true },
    where: { id: { in: skillIds } },
  });

  return skillIds.flatMap((skillId) => skills.find((skill) => skill.id === skillId) ?? []);
}

/**
 * The past papers of an exam goal whose questions may be quoted and aren't in the item bank yet:
 * the public papers its blueprint's topic frequency was read from, in the goal's language, when
 * the paper's reuse terms allow it and the exam's notice doesn't forbid it. Every other exam
 * keeps original questions only.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function listPastQuestionPapers({
  goalId,
}: {
  goalId: string;
}): Promise<PastPaperTarget[]> {
  const goal = await prisma.goal.findUnique({
    include: { examBlueprint: { include: { source: true } }, plan: { select: { graph: true } } },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint;

  if (!goal || goal.kind !== "exam" || !blueprint || blueprint.ownerId) {
    return [];
  }

  const content = readBlueprintContent(blueprint);
  const format = getExamChoiceFormat(content.structure);

  const paperIds = [
    ...new Set(content.topicFrequency.map((topic) => topic.citation.sourceId)),
  ].filter((id) => id !== blueprint.sourceId);

  if (!format || paperIds.length === 0 || forbidsQuoting(blueprint.source)) {
    return [];
  }

  const [papers, skills] = await Promise.all([
    prisma.source.findMany({
      select: { id: true, publisher: true, reusePolicy: true, title: true, url: true },
      where: {
        extractedText: { not: null },
        id: { in: paperIds },
        items: { none: { examBlueprintId: blueprint.id } },
        language: goal.language,
        visibility: "public",
      },
    }),
    loadGoalSkills(goal.plan?.graph),
  ]);

  return papers
    .filter((paper) => canQuotePastQuestions(paper) && skills.length > 0)
    .map((paper) => ({
      exam: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
      examBlueprintId: blueprint.id,
      format: format.kind,
      language: goal.language,
      optionCount: format.kind === "multipleChoice" ? format.options : null,
      paper: { id: paper.id, title: paper.title },
      skills,
    }));
}

/** The paper's text as stored when it was fetched: what quoted parts are checked against. */
export async function loadPastPaperText(paperId: string): Promise<string | null> {
  const paper = await prisma.source.findUnique({
    select: { extractedText: true },
    where: { id: paperId },
  });

  return paper?.extractedText ?? null;
}

type RejectedQuestion = { number: string; problems: string[] };

/**
 * Stores the questions copied from a past paper that pass the item checks and the quote checks
 * (every quoted part is in the paper as printed, the citation names the question), each on the
 * skill it tests, marked as quoted, in the paper's option order, citing it (`sourceCitation`)
 * and linked to it (`sourceId`), so practice shows where each came from. A paper is imported
 * once per exam: a second run for the same paper, even at the same moment, stores nothing.
 *
 * This is an internal workflow bridge: items are shared Library content.
 */
export async function savePastQuestions({
  paperText,
  provenance,
  questions,
  target,
}: {
  paperText: string;
  provenance: LibraryProvenance;
  questions: readonly PastQuestion[];
  target: PastPaperTarget;
}): Promise<{ created: number; rejected: RejectedQuestion[] }> {
  const checked = questions.map((question) => ({
    problems: [
      ...checkItem({
        expectedFormat: target.format,
        item: question.item,
        language: target.language,
        optionCount: target.optionCount,
      }),
      ...checkPastQuestion({ paperText, question, skillCount: target.skills.length }),
    ],
    question,
    skillId: target.skills[question.skill - 1]?.id,
  }));

  const passing = checked.flatMap(({ problems, question, skillId }) =>
    problems.length === 0 && skillId ? [{ question, skillId }] : [],
  );

  const rejected = checked
    .filter((entry) => entry.problems.length > 0)
    .map(({ problems, question }) => ({ number: question.number, problems }));

  const created = await prisma.$transaction(async (tx) => {
    const key = `${target.examBlueprintId}:${target.paper.id}`;

    await tx.$queryRaw(
      sql`SELECT pg_advisory_xact_lock(${IMPORT_LOCK_NAMESPACE}::int, hashtext(${key}))::text`,
    );

    const imported = await tx.item.count({
      where: { examBlueprintId: target.examBlueprintId, sourceId: target.paper.id },
    });

    if (imported > 0 || passing.length === 0) {
      return 0;
    }

    const { count } = await tx.item.createMany({
      data: passing.map(({ question, skillId }) => ({
        ...toStoredItem(question.item, { quoted: true }),
        examBlueprintId: target.examBlueprintId,
        language: target.language,
        skillId,
        sourceCitation: question.citation.trim(),
        sourceId: target.paper.id,
        ...toProvenanceData(provenance),
      })),
    });

    return count;
  });

  return { created, rejected };
}
