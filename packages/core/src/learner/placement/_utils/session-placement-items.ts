import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { interleave } from "@zoonk/utils/interleave";
import { loadListeningSkillIds } from "../../../exams/listening/listening-skills";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { isLowGuessTap, isQuickChoice } from "../../_utils/placement-guess-rate";
import { loadWritingSkillIds } from "../../writing-skills";
import { getTestQuestionStatuses, listUnaskedAreas } from "../focus-test-progress";
import { type TestSubject } from "../focus-test-subjects";
import { type PlacementEvidence } from "../placement-beliefs";
import { getKnownSubjects, getOwnLevel } from "../placement-contract";
import { pickPlacementItem } from "../placement-item-choice";
import { readSkillStatuses } from "../placement-known";
import { isOwnMaterialTest } from "../placement-material";
import { type PlacementQuickFormat } from "../placement-quick-format";
import { type SkillStatuses } from "../placement-status";
import { type AreaPriority, getUndecidedSkills, rankAreasToAsk } from "../placement-steps";
import { loadPlacementItems } from "./placement-bank-items";
import { type TestSkillAnswers, loadEvidence, loadSeenPlacementItems } from "./placement-evidence";

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

function hasRecentQuickChoice(answers: readonly Pick<PlacementEvidence, "format" | "outcome">[]) {
  const lastMiss = answers.findLastIndex((answer) => answer.outcome !== "correct");

  return answers
    .slice(Math.max(lastMiss + 1, answers.length - 3))
    .some((answer) => isQuickChoice(answer));
}

/** At most limit unseen quick questions, one per unsettled skill; never selects listening-only skills. */
export async function pickSessionChecks({
  areaShares,
  blueprint: knownBlueprint,
  easySkillIds = [],
  excludeItemIds,
  focusAreas,
  goal,
  limit,
  listeningSkillIds,
  quickFormat,
  recheckOnly = false,
  recheckSkillIds = new Set(),
  skills: planSkills,
  test,
  userId,
}: AreaPriority & {
  /** The goal's exam blueprint when the day's build already read it; without it, it's read fresh. */
  blueprint?: Pick<ExamBlueprint, "ownerId"> | null;
  easySkillIds?: readonly string[];
  excludeItemIds: ReadonlySet<string>;
  goal: Pick<Goal, "details" | "examBlueprintId" | "id">;
  limit: number;
  /** The day plan's listening-only skills; without them, they're read fresh. */
  listeningSkillIds?: ReadonlySet<string>;
  quickFormat: PlacementQuickFormat;
  recheckOnly?: boolean;
  recheckSkillIds?: ReadonlySet<string>;
  skills: GoalPlan["skills"];
  test?: SessionTest;
  userId: string;
}): Promise<{ placementItemIds: string[]; placementRecheckItemIds: string[] }> {
  const [listening, written] = await Promise.all([
    listeningSkillIds ?? loadListeningSkillIds(goal.id),
    loadWritingSkillIds(goal.id),
  ]);

  const skills = planSkills.filter((skill) => !listening.has(skill.id) && !written.has(skill.id));

  const easy = new Set(easySkillIds);

  const skillIds = skills
    .filter((skill) => !recheckOnly || recheckSkillIds.has(skill.id) || easy.has(skill.id))
    .map((skill) => skill.id);

  const [{ confirmationAnswers, evidence, seenItemIds, testSkills }, bankItems, blueprint] =
    await Promise.all([
      loadEvidence({ skillIds, userId }),
      loadPlacementItems({ examBlueprintId: goal.examBlueprintId, skillIds }),
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
    answers: confirmationAnswers,
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

  const answeredItems = await loadSeenPlacementItems({
    itemIds: bankItems.map((item) => item.id),
    userId,
  });

  const candidates = bankItems.map((item) => ({
    ...item,
    seen: seenItemIds.has(item.id) || answeredItems.has(item.id) || excludeItemIds.has(item.id),
  }));

  const taps = candidates.filter((item) => isQuickChoice(item) || isLowGuessTap(item));

  const rechecks = [...recheckSkillIds].flatMap(
    (skillId) => pickPlacementItem({ confirming: true, items: taps, quickFormat, skillId }) ?? [],
  );

  const bySkill = Map.groupBy(confirmationAnswers, (answer) => answer.skillId);

  const easyChecks = easySkillIds.flatMap((skillId) =>
    recheckSkillIds.has(skillId)
      ? []
      : (pickPlacementItem({
          confirming: hasRecentQuickChoice(bySkill.get(skillId) ?? []),
          items: taps,
          quickFormat,
          skillId,
        }) ?? []),
  );

  const priority = [...rechecks, ...easyChecks].map((item) => item.id);
  const placementRecheckItemIds = rechecks.slice(0, limit).map((item) => item.id);

  if (recheckOnly || priority.length >= limit) {
    return { placementItemIds: priority.slice(0, limit), placementRecheckItemIds };
  }

  const walk = interleaveByStart({
    evidence,
    priority: { areaShares, focusAreas },
    skills,
    undecided,
  });

  const regular = orderForTest({ skills: walk, test, testSkills }).flatMap(
    (skill) =>
      pickPlacementItem({
        confirming: evidence.some(
          (answer) => answer.skillId === skill.id && answer.outcome === "correct",
        ),
        items: candidates,
        quickFormat,
        skillId: skill.id,
      }) ?? [],
  );

  return {
    placementItemIds: [...new Set([...priority, ...regular.map((item) => item.id)])].slice(
      0,
      limit,
    ),
    placementRecheckItemIds,
  };
}
