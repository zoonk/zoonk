import { getBossSkillIds } from "../../../checkpoints/checkpoint-rules";
import { listCoreLessonItems } from "../../_utils/core-lessons";
import { toIsoDate } from "../../planner/plan-calendar";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import {
  findLastDue,
  isHeldOnShownEnd,
  isTodoLesson,
  listPhaseDatesProposals,
  toDay,
} from "./rule-items";

/**
 * The skills each challenge asks, as the session's duel and the questions written for it do
 * (`getBossSkillIds`: its phase's skills whose core comes by its day, else what was begun by then),
 * by the challenge's place in the plan.
 */
function listAskedSkillIds(plan: RulePlan): Map<number, string[]> {
  const items = plan.items.map((item, position) => ({
    ...item,
    id: String(position),
    phase: item.phase ?? 0,
    position,
  }));

  const firsts = items.filter(
    (item, position) =>
      item.skillId && items.findIndex((other) => other.skillId === item.skillId) === position,
  );

  const skills = firsts.map((item) => ({ id: item.skillId ?? "", phase: item.phase }));
  const itemSkillIds = new Map(items.map((item) => [item.id, item.skillId ? [item.skillId] : []]));

  return new Map(
    items.flatMap((boss) =>
      boss.kind === "boss"
        ? [
            [
              boss.position,
              getBossSkillIds({
                boss,
                graphSkills: plan.graph.skills,
                itemSkillIds,
                items,
                skills,
              }),
            ] as const,
          ]
        : [],
    ),
  );
}

/**
 * The skills a challenge owns: the ones it asks (`listAskedSkillIds`), and in a plan whose phases
 * come from the skill graph, its graph phase's skills too, wherever the plan filed their lessons
 * (career seed 1027 filed a phase's lessons past its kept end under the next phase's time). An
 * exam plan's time-boxed phases have nothing to do with the graph's. A skill heard only through
 * recordings is left out of a challenge with written questions (`loadBossQuestions`).
 */
function listOwnedSkillIds({
  asked,
  challenge,
  listening,
  plan,
}: {
  asked: readonly string[];
  challenge: RuleItem;
  listening: ReadonlySet<string>;
  plan: RulePlan;
}): Set<string> {
  const fromGraph =
    plan.phases[challenge.phase ?? -1]?.kind === "learn"
      ? plan.graph.skills.flatMap((skill) =>
          skill.phase === challenge.phase ? [skill.skillId] : [],
        )
      : [];

  const owned = [...new Set([...asked, ...fromGraph])];
  const written = owned.filter((skillId) => !listening.has(skillId));

  return new Set(written.length > 0 ? written : owned);
}

/**
 * The first phase whose end Today's proposal moves so its lessons come before its challenge
 * (`lessonsFirst`), waiting or kept ("Keep mine"); null without one. Later phases' lessons can
 * spill over from that end, a day per phase, and moving it fits them again, so the card names only
 * that move (language seed 2), and keeping it keeps that spill too.
 */
function findFirstMovedForLessons(context: RuleContext): number | null {
  const moved = listPhaseDatesProposals(context)
    .flatMap((change) => change.effect?.phaseEnds ?? [])
    .filter((move) => move.lessonsFirst === true)
    .map((move) => context.after.phases.findIndex((phase) => phase.name === move.name))
    .filter((index) => index !== -1);

  return moved.length > 0 ? Math.min(...moved) : null;
}

/**
 * R40. A phase's challenge comes after its own lessons: a challenge still to do is due no earlier
 * than the core lessons still to do of the skills it owns (`listOwnedSkillIds`), wherever the plan
 * dated them. The depth a plan short on time studies once every core is in may come later. A
 * challenge held on the end the learner saw while Today asks to move that end, or after they kept
 * it on a card that said its lessons come after it, is left out, as in R21, and so is a later one
 * behind such a card's earliest end: moving that end fits the lessons that spill from it.
 */
export function checkChallengeAfterLessons(context: RuleContext): RuleViolation[] {
  const { after, learner } = context;

  const core = new Set(
    [
      ...listCoreLessonItems({ graphSkills: after.graph.skills, items: after.items }).values(),
    ].flat(),
  );

  const askedBy = listAskedSkillIds(after);
  const listening = new Set(learner?.listeningSkillIds);
  const firstMoved = findFirstMovedForLessons(context);

  return after.items.flatMap((challenge, position) => {
    const due = challenge.scheduledFor;

    if (
      challenge.kind !== "boss" ||
      challenge.status !== "todo" ||
      !due ||
      isHeldOnShownEnd({ context, item: challenge, reason: "lessonsFirst" }) ||
      (firstMoved !== null && (challenge.phase ?? 0) > firstMoved)
    ) {
      return [];
    }

    const owned = listOwnedSkillIds({
      asked: askedBy.get(position) ?? [],
      challenge,
      listening,
      plan: after,
    });

    const later = after.items.filter(
      (item) =>
        core.has(item) &&
        isTodoLesson(item) &&
        owned.has(item.skillId ?? "") &&
        item.scheduledFor !== null &&
        item.scheduledFor > due,
    );

    return later.length > 0
      ? [
          {
            details: {
              challenge: toIsoDate(due),
              lastLesson: toDay(findLastDue(later)),
              later: later.length,
              phase: challenge.phase,
              skills: [...new Set(later.map((item) => item.skillId))],
            },
            message: `Phase ${(challenge.phase ?? 0) + 1}'s challenge on ${toIsoDate(due)} comes before ${later.length} core lessons of its skills.`,
            rule: "R40",
          },
        ]
      : [];
  });
}
