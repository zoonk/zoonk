import { type Goal, type PlanItem } from "@zoonk/db";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanGraphSkill, type PlanPhase } from "../../plans/planner/plan-state";
import { getBossQuestionSkills } from "../checkpoint-minutes";
import { type BossPlanItem, getBossCoreLessons, getBossSkillIds } from "../checkpoint-rules";

type BossItem = Pick<PlanItem, "kind" | "phase" | "position" | "scheduledFor" | "status">;

type ChallengeItem = BossPlanItem & BossItem;

export type ChallengeTeaching = {
  graphSkills: readonly Pick<PlanGraphSkill, "lessons" | "phase" | "plannedLessons" | "skillId">[];
  itemSkillIds: ReadonlyMap<string, readonly string[]>;
  listeningSkillIds: ReadonlySet<string>;
  /** In plan order, without the areas the learner left out. */
  skills: readonly { id: string }[];
};

/** What R40 reads to tell whether a due challenge's own teaching is still to do; items in plan order. */
export type ChallengePlan<Item extends ChallengeItem = ChallengeItem> = ChallengeTeaching & {
  goal: Pick<Goal, "kind" | "targetDate">;
  items: readonly Item[];
  phases: readonly Pick<PlanPhase, "endDate">[];
};

/** `nextSession` is due next; `queued` waits for an earlier phase; `date` uses the saved day. */
export type BossTiming = "date" | "nextSession" | "queued";

export function isBossDue({ boss, today }: { boss: BossItem; today: Date }): boolean {
  return (
    boss.kind === "boss" &&
    boss.status === "todo" &&
    boss.scheduledFor !== null &&
    boss.scheduledFor <= today
  );
}

/** A dated exam's phases are time windows unrelated to the graph's, so only the skills a challenge asks are its own there. */
function listOwnSkillIds({ boss, plan }: { boss: BossItem; plan: ChallengePlan }): string[] {
  const { goal, graphSkills, listeningSkillIds } = plan;
  const datedExam = goal.kind === "exam" && goal.targetDate !== null;
  const asked = getBossSkillIds({ ...plan, boss, targetDate: goal.targetDate });

  const graphPhase = datedExam
    ? []
    : graphSkills.flatMap((skill) => (skill.phase === boss.phase ? [skill.skillId] : []));

  return getBossQuestionSkills({
    listeningSkillIds,
    skillIds: [...new Set([...asked, ...graphPhase])],
  }).skillIds;
}

/** R40: lessons dated today don't hold it, since an exam's challenge may share a day with its last lessons. */
function isWaitingForTeaching({
  boss,
  plan,
  today,
}: {
  boss: BossItem;
  plan: ChallengePlan;
  today: Date;
}): boolean {
  const { goal, phases } = plan;
  const windowEnd = goal.kind === "exam" && goal.targetDate ? phases[boss.phase]?.endDate : null;
  const core = getBossCoreLessons({ ...plan, boss, targetDate: goal.targetDate });

  const isLeftToDo = (lesson: ChallengeItem) =>
    lesson.status === "todo" &&
    lesson.scheduledFor !== null &&
    lesson.scheduledFor < today &&
    (!windowEnd || toIsoDate(lesson.scheduledFor) <= windowEnd);

  return listOwnSkillIds({ boss, plan }).some((skillId) =>
    (core.get(skillId) ?? []).some((lesson) => isLeftToDo(lesson)),
  );
}

export function isBossReached({
  boss,
  plan,
  today,
}: {
  boss: BossItem;
  plan: ChallengePlan;
  today: Date;
}): boolean {
  return isBossDue({ boss, today }) && !isWaitingForTeaching({ boss, plan, today });
}

/** Due challenges in phase order, up to the first one still waiting for its own lessons. */
export function findSessionBosses<Item extends ChallengeItem>({
  plan,
  today,
}: {
  plan: ChallengePlan<Item>;
  today: Date;
}): Item[] {
  const first = plan.items.find((boss) => isBossDue({ boss, today }));

  if (!first) {
    return [];
  }

  const due = [
    first,
    ...plan.items
      .filter((boss) => boss.phase > first.phase && isBossDue({ boss, today }))
      .toSorted((a, b) => a.phase - b.phase),
  ];

  const waiting = due.findIndex((boss) => isWaitingForTeaching({ boss, plan, today }));
  return waiting === -1 ? due : due.slice(0, waiting);
}

export function getBossTimings({
  plan,
  today,
}: {
  plan: ChallengePlan;
  today: Date;
}): ReadonlyMap<string, BossTiming> {
  const ordered = { ...plan, items: plan.items.toSorted((a, b) => a.position - b.position) };
  const next = new Set(findSessionBosses({ plan: ordered, today }));

  return new Map(
    ordered.items.flatMap((boss): [string, BossTiming][] => {
      if (boss.kind !== "boss" || boss.status !== "todo") {
        return [];
      }

      const id = boss.id ?? boss.key ?? "";

      if (next.has(boss)) {
        return [[id, "nextSession"]];
      }

      return [[id, isBossReached({ boss, plan, today }) ? "queued" : "date"]];
    }),
  );
}
