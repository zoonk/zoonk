import { isDeepStrictEqual } from "node:util";
import { NOTICE_SOURCE } from "../../plan-change-contract";
import { type PlanChangeView } from "../../plan-view-contract";
import { type RuleContext, type RuleViolation } from "./rule-context";

/** What a proposal asks and answers: the same with nothing new since means the same proposal. */
function toAsk(change: PlanChangeView) {
  return {
    effect: change.effect,
    kind: change.kind,
    officialDate: change.officialDate,
    operations: change.operations,
  };
}

/** A change the exam's notice proposes (its date, or the plan following it). */
function isNoticeChange(change: PlanChangeView): boolean {
  return change.source === NOTICE_SOURCE;
}

/**
 * R33. A declined proposal isn't offered again until something new happens (a new edition, a new
 * date, progress that changes the answer): no proposal asks the same as one the learner declined,
 * with the same operations and the same effect, except on a new edition of the notice, which is
 * new. A notice change the learner declined is offered again once per edition: a new edition that
 * would change the plan proposes it.
 */
export function checkDeclinedNotReoffered(context: RuleContext): RuleViolation[] {
  const { changes = [], declined = [], event } = context;
  const newEdition = event.kind === "noticeEdition";
  const proposed = changes.filter((change) => change.status === "proposed");

  const repeated = newEdition
    ? []
    : proposed.filter((change) =>
        declined.some((old) => isDeepStrictEqual(toAsk(old), toAsk(change))),
      );

  const owed =
    event.kind === "noticeEdition" &&
    event.changesPlan &&
    declined.some((change) => isNoticeChange(change)) &&
    !proposed.some((change) => isNoticeChange(change));

  return [
    ...repeated.map((change) => ({
      details: { changeId: change.id, kind: change.kind, operations: change.operations },
      message: "A proposal the learner declined was offered again with nothing new.",
      rule: "R33",
    })),
    ...(owed
      ? [
          {
            details: { declined: declined.filter((change) => isNoticeChange(change)).length },
            message: "A new edition of the notice changes the plan, and its change wasn't offered.",
            rule: "R33",
          },
        ]
      : []),
  ];
}
