import "server-only";
import { type GoalTutorLookUpResult } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type Goal, prisma } from "@zoonk/db";
import { loadGoalSkillIds } from "../../../learner/_utils/goal-skill-graph";
import { readMistakeSnapshot } from "../../../mistakes/mistake-snapshot";
import { getSkillArea } from "../../../plans/planner/graph-areas";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanGraph } from "../../../plans/planner/plan-state";
import { matchesArea, matchesQuery } from "./lookup-text";

const MAX_MISTAKES = 8;

/** Query searches cover only the latest 200 mistakes. */
const SEARCHED_MISTAKES = 200;

const MAX_TEXT = 300;

function shorten(text: string | null | undefined): string | null {
  return text ? text.slice(0, MAX_TEXT) : null;
}

async function loadSkillIds({ area, goal }: { area: string | null; goal: Goal }) {
  if (!area) {
    return loadGoalSkillIds(goal.id);
  }

  const plan = await prisma.plan.findUnique({
    select: { graph: true },
    where: { goalId: goal.id },
  });

  const graph = parsePlanGraph(plan?.graph ?? {});

  return graph.skills
    .filter((skill) => matchesArea({ area, names: [getSkillArea({ graph, skill })] }))
    .map((skill) => skill.skillId);
}

/** Includes open and fixed mistakes newest first, using their recorded question and answers. */
export async function lookUpMistakes({
  area,
  goal,
  query,
}: {
  area: string | null;
  goal: Goal;
  query: string | null;
}): Promise<GoalTutorLookUpResult> {
  const skillIds = await loadSkillIds({ area, goal });

  const rows = await prisma.mistake.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      cause: true,
      createdAt: true,
      skill: { select: { name: true } },
      snapshot: true,
      status: true,
    },
    take: SEARCHED_MISTAKES,
    where: { skillId: { in: skillIds }, userId: goal.userId },
  });

  const mistakes = rows
    .map((row) => ({ ...row, snapshot: readMistakeSnapshot(row.snapshot) }))
    .filter(
      (row) =>
        !query ||
        matchesQuery({ query, text: `${row.skill?.name ?? ""} ${row.snapshot.question ?? ""}` }),
    );

  if (mistakes.length === 0) {
    return { status: "notFound", what: "mistakes" };
  }

  const shown = mistakes.slice(0, MAX_MISTAKES);

  return {
    mistakes: shown.map((row) => ({
      answer: shorten(row.snapshot.answer),
      cause: row.cause,
      correctAnswer: shorten(row.snapshot.correctAnswer),
      date: toIsoDate(row.createdAt),
      question: shorten(row.snapshot.question) ?? "",
      skill: row.skill?.name ?? null,
      status: row.status,
    })),
    moreMistakes: mistakes.length - shown.length,
    status: "found",
    what: "mistakes",
  };
}
