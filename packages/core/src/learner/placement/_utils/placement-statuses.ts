import { isLowGuessTap } from "../../_utils/placement-guess-rate";
import { getTestQuestionStatuses } from "../focus-test-progress";
import { PRIOR_BELIEF, getOwnBeliefs } from "../placement-beliefs";
import { type PlacementItemCandidate } from "../placement-item-choice";
import { readSkillStatuses } from "../placement-known";
import { getSkillPlacementStatus } from "../placement-status";
import { type TestTurn } from "./focus-test-setup";
import { type TestSkillAnswers } from "./placement-evidence";

type StatusFacts = Parameters<typeof readSkillStatuses>[0] & {
  items: readonly PlacementItemCandidate[];
  testSkills: readonly TestSkillAnswers[];
  turn: TestTurn | null;
};

export function readStatuses({ items, testSkills, turn, ...facts }: StatusFacts) {
  const statuses = readSkillStatuses(facts);

  const unconfirmedTapSkills = new Set(
    items.filter((item) => !item.seen && isLowGuessTap(item)).map((item) => item.skillId),
  );

  const missed = new Set(
    facts.answers.filter((answer) => answer.outcome !== "correct").map((answer) => answer.skillId),
  );

  const own = getOwnBeliefs({
    evidence: facts.answers,
    priors: new Map(facts.skills.map((skill) => [skill.id, PRIOR_BELIEF])),
  });

  const routed = new Map(
    [...statuses].map(([skillId, status]) => [
      skillId,
      status !== "unknown" &&
      !unconfirmedTapSkills.has(skillId) &&
      !missed.has(skillId) &&
      getSkillPlacementStatus(own.get(skillId)) === "known"
        ? ("known" as const)
        : status,
    ]),
  );

  const questionStatuses = turn
    ? getTestQuestionStatuses({
        areaOf: (skillId) => turn.setup.areaOf.get(skillId) ?? null,
        statuses: routed,
        subjects: turn.setup.subjects,
        testSkills,
      })
    : routed;

  return { questionStatuses, statuses: routed };
}
