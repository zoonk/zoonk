import "server-only";
import { type StatuteDrill } from "@zoonk/ai/tasks/v2/items/statute-drills";
import { prisma } from "@zoonk/db";
import { type LibraryProvenance } from "../../library/_utils/library-rows";
import { examStructureSchema } from "../../library/exams/blueprint-contract";
import { createItems } from "../../library/items/create-items";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { namesMatch } from "../_utils/name-match";
import {
  type StatuteArticleText,
  isStatuteSource,
  splitStatuteArticles,
  toStatuteShortName,
} from "./statute-articles";

/** A goal drills the first articles of up to two laws; more come as the plan reaches them. */
const MAX_LAWS = 2;
const ARTICLES_PER_LAW = 8;
const FGV_PATTERN = /\bfgv\b/iu;

type StatuteDrillStyle = "cebraspe" | "fgv" | "generic";

/** One law to drill for a goal: its articles, the skill it belongs to and the board's style. */
export type StatuteDrillTarget = {
  articles: StatuteArticleText[];
  examBlueprintId: string;
  language: string;
  law: { shortName: string; title: string; url: string | null };
  skillId: string;
  sourceId: string;
  style: StatuteDrillStyle;
};

/** How the board asks about the letter of the law: Cebraspe's right or wrong, FGV's options. */
function getStyle({
  board,
  method,
}: {
  board: string | null;
  method: string | null;
}): StatuteDrillStyle {
  if (method === "wrongCancelsRight") {
    return "cebraspe";
  }

  return board && FGV_PATTERN.test(board) ? "fgv" : "generic";
}

/** The goal skill a law belongs to: one whose name or area names the law. */
function findLawSkill({
  skills,
  title,
}: {
  skills: ReturnType<typeof parsePlanGraph>["skills"];
  title: string;
}): string | null {
  const shortName = toStatuteShortName(title);

  const skill = skills.find(
    (candidate) =>
      namesMatch(candidate.name, shortName) ||
      (candidate.area !== null && namesMatch(candidate.area, shortName)),
  );

  return skill?.skillId ?? null;
}

/**
 * The laws a public-service exam goal should drill word for word: statutes among the goal's
 * sources (by title or the official site), each matched to the goal skill that names it. Laws no
 * skill names are left for the lessons. Internal workflow bridge: the goal id comes from the
 * public boundary that created the goal.
 */
export async function loadStatuteDrillTargets(goalId: string): Promise<StatuteDrillTarget[]> {
  const goal = await prisma.goal.findUnique({
    include: { examBlueprint: true, plan: { select: { graph: true } } },
    where: { id: goalId },
  });

  const blueprint = goal?.examBlueprint;

  if (!goal || goal.kind !== "exam" || !blueprint) {
    return [];
  }

  const sources = await prisma.learnerSource.findMany({
    select: { source: true },
    where: { goalId, source: { extractedText: { not: null } } },
  });

  const skills = parsePlanGraph(goal.plan?.graph).skills;
  const method = examStructureSchema.safeParse(blueprint.structure).data?.mock?.scoring.method;
  const style = getStyle({ board: blueprint.board, method: method ?? null });

  return sources
    .map(({ source }) => source)
    .filter((source) => isStatuteSource({ title: source.title, url: source.url }))
    .flatMap((source) => {
      const skillId = findLawSkill({ skills, title: source.title });
      const articles = splitStatuteArticles(source.extractedText ?? "").slice(0, ARTICLES_PER_LAW);

      return skillId && articles.length > 0
        ? [
            {
              articles,
              examBlueprintId: blueprint.id,
              language: goal.language,
              law: {
                shortName: toStatuteShortName(source.title),
                title: source.title,
                url: source.url,
              },
              skillId,
              sourceId: source.id,
              style,
            },
          ]
        : [];
    })
    .slice(0, MAX_LAWS);
}

/**
 * Stores a law's drills as items on its skill, each citing its article ("Lei nº 8.112, Art. 13")
 * and linked to the law's source, so practice can show the reference and open the official text.
 */
export async function writeStatuteDrills({
  drills,
  optionCount,
  provenance,
  target,
}: {
  drills: readonly StatuteDrill[];
  optionCount: number;
  provenance: LibraryProvenance;
  target: StatuteDrillTarget;
}): Promise<number> {
  const groups = [
    ...Map.groupBy(drills, (drill) => `${drill.format}\u0000${drill.reference}`).values(),
  ];

  const created = await Promise.all(
    groups.flatMap((group) => {
      const [first] = group;

      return first
        ? [
            createItems({
              examBlueprintId: target.examBlueprintId,
              format: first.format,
              items: group.map(({ reference: _reference, ...item }) => item),
              language: target.language,
              optionCount: first.format === "multipleChoice" ? optionCount : null,
              provenance: {
                ...provenance,
                runId: `${provenance.runId}:${first.format}:${first.reference}`,
              },
              skillId: target.skillId,
              sourceCitation: `${target.law.shortName}, ${first.reference}`,
              sourceId: target.sourceId,
            }).then((result) => result.created.length),
          ]
        : [];
    }),
  );

  return created.reduce((sum, count) => sum + count, 0);
}
