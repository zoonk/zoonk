import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { interleave } from "@zoonk/utils/interleave";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { getKnownSubjects, getOwnLevel } from "../placement-contract";
import { readSkillStatuses } from "../placement-known";
import { isOwnMaterialTest } from "../placement-material";
import { type PlacementQuickFormat, compareQuickFormat } from "../placement-quick-format";
import { type SkillStatuses } from "../placement-status";
import { type AreaPriority, getUndecidedSkills, rankAreasToAsk } from "../placement-steps";
import { loadPlacementItems } from "./placement-bank-items";
import { loadEvidence } from "./placement-evidence";

type StartSkill = { id: string; phase: number; sectionTitle: string | null };

function interleaveByStart<TSkill extends StartSkill>({
  evidence,
  priority,
  skills,
  undecided,
}: {
  evidence: readonly { skillId: string }[];
  priority: AreaPriority;
  skills: readonly StartSkill[];
  undecided: readonly TSkill[];
}): TSkill[] {
  const areaOf = new Map(skills.map((skill) => [skill.id, skill.sectionTitle]));

  const answers = new Map(
    [...Map.groupBy(evidence, (answer) => areaOf.get(answer.skillId) ?? null)].map(
      ([area, items]) => [area, items.length] as const,
    ),
  );

  const groups = [
    ...Map.groupBy(undecided, (skill) =>
      JSON.stringify([skill.phase, skill.sectionTitle]),
    ).values(),
  ];

  const ranked = rankAreasToAsk({
    ...priority,
    answers,
    areas: [...new Set(groups.map((group) => group[0]?.sectionTitle ?? null))],
  });

  const rankOf = (group: readonly TSkill[]) => ranked.indexOf(group[0]?.sectionTitle ?? null);

  return interleave(groups.toSorted((a, b) => rankOf(a) - rankOf(b)));
}

function claimedFirst<TSkill extends { id: string }>({
  skills,
  statuses,
}: {
  skills: readonly TSkill[];
  statuses: SkillStatuses;
}): TSkill[] {
  const rank = (skill: TSkill) => (statuses.get(skill.id) === "claimed" ? 0 : 1);
  return skills.toSorted((a, b) => rank(a) - rank(b));
}

/** At most limit unseen quick questions, one per unsettled skill; never selects listening-only skills. */
export async function pickSessionPlacementItems({
  areaShares,
  excludeItemIds,
  focusAreas,
  goal,
  limit,
  quickFormat,
  skills: planSkills,
  userId,
}: AreaPriority & {
  excludeItemIds: ReadonlySet<string>;
  goal: Pick<Goal, "details" | "examBlueprintId" | "id">;
  limit: number;
  quickFormat: PlacementQuickFormat;
  skills: GoalPlan["skills"];
  userId: string;
}): Promise<string[]> {
  const listening = await loadListeningSkillIds(goal.id);
  const skills = planSkills.filter((skill) => !listening.has(skill.id));
  const skillIds = skills.map((skill) => skill.id);

  const [{ evidence, placementAnswers, seenItemIds }, bankItems, blueprint] = await Promise.all([
    loadEvidence({ skillIds, userId }),
    // Sessions grade immediately; typed confirmation stays in placement.
    loadPlacementItems({ examBlueprintId: goal.examBlueprintId, skillIds, typed: false }),
    goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({
          select: { ownerId: true },
          where: { id: goal.examBlueprintId },
        })
      : null,
  ]);

  const answeredOnly = isOwnMaterialTest(blueprint);

  const focus = new Set(focusAreas);

  const statuses = readSkillStatuses({
    answeredOnly,
    answers: placementAnswers,
    evidence,
    focusedSkillIds: new Set(
      skills.flatMap((skill) => (focus.has(skill.sectionTitle ?? "") ? [skill.id] : [])),
    ),
    knownAreas: getKnownSubjects(goal),
    ownLevel: getOwnLevel({ goal }),
    skills,
  });

  const undecided = claimedFirst({
    skills: getUndecidedSkills({ answeredOnly, skills, statuses }),
    statuses,
  });

  const askable = bankItems
    .filter((item) => !seenItemIds.has(item.id) && !excludeItemIds.has(item.id))
    .toSorted((a, b) => compareQuickFormat({ a: a.format, b: b.format, quickFormat }));

  return interleaveByStart({ evidence, priority: { areaShares, focusAreas }, skills, undecided })
    .flatMap((skill) => askable.find((item) => item.skillId === skill.id) ?? [])
    .slice(0, limit)
    .map((item) => item.id);
}
