import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { interleave } from "@zoonk/utils/interleave";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { getTestQuestionStatuses, listUnaskedAreas } from "../focus-test-progress";
import { type TestSubject } from "../focus-test-subjects";
import { getKnownSubjects, getOwnLevel } from "../placement-contract";
import { readSkillStatuses } from "../placement-known";
import { isOwnMaterialTest } from "../placement-material";
import { type PlacementQuickFormat, compareQuickFormat } from "../placement-quick-format";
import { type SkillStatuses } from "../placement-status";
import { type AreaPriority, getUndecidedSkills, rankAreasToAsk } from "../placement-steps";
import { loadPlacementItems } from "./placement-bank-items";
import { type TestSkillAnswers, loadAnsweredTestItems, loadEvidence } from "./placement-evidence";

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

/** An exam goal's Focus test, whose sessions ask the subjects with no test answer first. */
export type SessionTest = {
  areaOf: ReadonlyMap<string, string>;
  subjects: readonly TestSubject[];
  /** Past the first week, sessions ask only about subjects with no test answer. */
  unaskedOnly: boolean;
};

function orderForTest<TSkill extends StartSkill>({
  skills,
  test,
  testSkills,
}: {
  skills: readonly TSkill[];
  test: SessionTest | undefined;
  testSkills: readonly TestSkillAnswers[];
}): TSkill[] {
  if (!test) {
    return [...skills];
  }

  const areaOf = new Map(skills.map((skill) => [skill.id, skill.sectionTitle]));

  const unasked = listUnaskedAreas({
    areaOf: (skillId) => test.areaOf.get(skillId) ?? areaOf.get(skillId) ?? null,
    subjects: test.subjects,
    testSkills,
  });

  const isUnasked = (skill: TSkill) =>
    unasked.has(test.areaOf.get(skill.id) ?? skill.sectionTitle ?? "");

  return test.unaskedOnly
    ? skills.filter((skill) => isUnasked(skill))
    : skills.toSorted((a, b) => Number(isUnasked(b)) - Number(isUnasked(a)));
}

/** At most limit unseen quick questions, one per unsettled skill; never selects listening-only skills. */
export async function pickSessionPlacementItems({
  areaShares,
  blueprint: knownBlueprint,
  excludeItemIds,
  focusAreas,
  goal,
  limit,
  listeningSkillIds,
  quickFormat,
  skills: planSkills,
  test,
  userId,
}: AreaPriority & {
  /** The goal's exam blueprint when the day's build already read it; without it, it's read fresh. */
  blueprint?: Pick<ExamBlueprint, "ownerId"> | null;
  excludeItemIds: ReadonlySet<string>;
  goal: Pick<Goal, "details" | "examBlueprintId" | "id">;
  limit: number;
  /** The day plan's listening-only skills; without them, they're read fresh. */
  listeningSkillIds?: ReadonlySet<string>;
  quickFormat: PlacementQuickFormat;
  skills: GoalPlan["skills"];
  test?: SessionTest;
  userId: string;
}): Promise<string[]> {
  const listening = listeningSkillIds ?? (await loadListeningSkillIds(goal.id));
  const skills = planSkills.filter((skill) => !listening.has(skill.id));
  const skillIds = skills.map((skill) => skill.id);

  const [{ evidence, placementAnswers, seenItemIds, testSkills }, bankItems, blueprint] =
    await Promise.all([
      loadEvidence({ skillIds, userId }),
      // Sessions grade immediately; typed confirmation stays in placement.
      loadPlacementItems({ examBlueprintId: goal.examBlueprintId, skillIds, typed: false }),
      knownBlueprint === undefined && goal.examBlueprintId
        ? prisma.examBlueprint.findUnique({
            select: { ownerId: true },
            where: { id: goal.examBlueprintId },
          })
        : (knownBlueprint ?? null),
    ]);

  const answeredOnly = isOwnMaterialTest(blueprint);

  const statuses = readSkillStatuses({
    answeredOnly,
    answers: placementAnswers,
    evidence,
    knownAreas: getKnownSubjects(goal),
    ownLevel: getOwnLevel({ goal }),
    skills,
  });

  const areaOf = new Map(skills.map((skill) => [skill.id, skill.sectionTitle]));

  const questionStatuses = test
    ? getTestQuestionStatuses({
        areaOf: (skillId) => test.areaOf.get(skillId) ?? areaOf.get(skillId) ?? null,
        statuses,
        subjects: test.subjects,
        testSkills,
      })
    : statuses;

  const undecided = claimedFirst({
    skills: getUndecidedSkills({ answeredOnly, skills, statuses: questionStatuses }),
    statuses: questionStatuses,
  });

  const answeredItems = await loadAnsweredTestItems({
    itemIds: bankItems.map((item) => item.id),
    userId,
  });

  const askable = bankItems
    .filter(
      (item) =>
        !seenItemIds.has(item.id) && !answeredItems.has(item.id) && !excludeItemIds.has(item.id),
    )
    .toSorted((a, b) => compareQuickFormat({ a: a.format, b: b.format, quickFormat }));

  const walk = interleaveByStart({
    evidence,
    priority: { areaShares, focusAreas },
    skills,
    undecided,
  });

  return orderForTest({ skills: walk, test, testSkills })
    .flatMap((skill) => askable.find((item) => item.skillId === skill.id) ?? [])
    .slice(0, limit)
    .map((item) => item.id);
}
