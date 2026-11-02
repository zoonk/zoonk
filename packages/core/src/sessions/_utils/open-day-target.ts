import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getBlockWait } from "../block-wait";
import { isSameDayWork, resolveDayBlock, toDayBlockRef } from "../day-block";
import { type DayTargetStatus, type OpenDayTarget } from "../open-day-contract";
import { type StudyBlockView, type StudySessionView } from "./session-view";

export function findOpenDayTarget({
  session,
  shownDate,
  target,
}: {
  session: StudySessionView;
  shownDate: string;
  target?: OpenDayTarget;
}): { target: StudyBlockView | null; targetStatus: DayTargetStatus | null } {
  if (shownDate !== toIsoDate(session.localDate)) {
    return { target: null, targetStatus: "otherDay" };
  }

  if (!target) {
    return { target: null, targetStatus: null };
  }

  const resolved =
    target.kind === "ref" ? resolveDayBlock({ blocks: session.blocks, ref: target.ref }) : null;

  const next = session.blocks.find((candidate) => candidate.id === session.nextBlockId);
  const picked = resolved?.status === "resolved" ? resolved.block : undefined;
  const block = target.kind === "next" ? next : picked;

  if (!block) {
    return { target: null, targetStatus: resolved?.status === "ambiguous" ? "ambiguous" : "gone" };
  }

  if (
    target.kind === "next" &&
    ((target.shown && !isSameDayWork(target.shown, toDayBlockRef(block))) ||
      (!target.shown && block.checkpoint?.mock))
  ) {
    return { target: null, targetStatus: "changed" };
  }

  if (
    (block.status !== "pending" && block.status !== "active") ||
    getBlockWait({ block, blocks: session.blocks })
  ) {
    return { target: null, targetStatus: "notStartable" };
  }

  return { target: block, targetStatus: target.kind === "next" ? "next" : "resolved" };
}
