import { type Finding } from "./checks.mts";
import { lead } from "./craft-rules.mts";
import { type Moved } from "./states-probe.mts";
import { type Step } from "./states.mts";

const MIN_PX = 2;
const LISTED = 3;

function moved(change: Moved) {
  return {
    across: change.after.left - change.before.left,
    down: change.after.top - change.before.top,
    taller: change.after.height - change.before.height,
    wider: change.after.width - change.before.width,
  };
}

function describe(change: Moved) {
  const { across, down } = moved(change);

  const ways = [
    Math.abs(across) >= MIN_PX ? `${Math.abs(across)} px ${across > 0 ? "right" : "left"}` : "",
    Math.abs(down) >= MIN_PX ? `${Math.abs(down)} px ${down > 0 ? "down" : "up"}` : "",
  ].filter(Boolean);

  if (ways.length > 0) {
    return `${change.label} moved ${ways.join(" and ")}`;
  }

  const { after, before } = change;
  return `${change.label} went from ${before.width}×${before.height} to ${after.width}×${after.height} px`;
}

function size({ across, down, taller, wider }: ReturnType<typeof moved>) {
  return Math.max(Math.abs(across), Math.abs(down), Math.abs(taller), Math.abs(wider));
}

/**
 * The changes a person would see as the screen jumping: something that moved on its own (not
 * carried by a parent that moved), and a control, panel or picture that changed size. A fold or a
 * tab may push what's under it down, and a search field may change the list under it: that's what
 * they're for. The boxes holding the field or choice grow with what appeared in them, which their
 * moved neighbors already show.
 */
function jumps({ action, comparison }: Step): Moved[] {
  const { target } = comparison;
  const pushesDown = (action.kind === "fold" || action.kind === "search") && target !== null;

  return comparison.moved.filter((change) => {
    const { across, down, taller, wider } = moved(change);
    const shifted = Math.max(Math.abs(across), Math.abs(down)) >= MIN_PX;
    const resized = Math.max(Math.abs(taller), Math.abs(wider)) >= MIN_PX;

    const below =
      pushesDown &&
      !change.isTarget &&
      across === 0 &&
      change.before.top >= target.top + target.height - 1;

    return !below && ((shifted && !change.carried) || (resized && change.drawn && !change.holds));
  });
}

export function stateLeads(steps: Step[]): Finding[] {
  return steps.flatMap((step) => {
    const seen = jumps(step);

    if (seen.length === 0) {
      return [];
    }

    const listed = seen.slice(0, LISTED).map((change) => describe(change));
    const more = seen.length > LISTED ? ` and ${seen.length - LISTED} more` : "";
    const failed = step.blocked ? " (the walk blocked its save, so this is a failed save)" : "";

    return [
      lead(
        "X3",
        `${step.doing} ${step.action.label}: ${listed.join("; ")}${more}${failed}`,
        Math.max(...seen.map((change) => size(moved(change)))),
      ),
    ];
  });
}
