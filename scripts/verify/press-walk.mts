import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type Page } from "@playwright/test";
import { type Finding } from "./checks.mts";
import {
  type Press,
  controlName,
  findOverlaps,
  overlapFindings,
  pressFindings,
  pressMoves,
  restoreMoves,
} from "./press-checks.mts";
import {
  type Frame,
  markMoved,
  markOverlaps,
  readFrame,
  readRegions,
  readTextLines,
  showMarks,
} from "./press-probe.mts";
import { type Action, type Comparison, snapshotLayout } from "./states-probe.mts";

/**
 * With `--press`: what was pressed, and the controls only held (never clicked) with why: a link
 * would leave the page, a submit button would send its form, and another button may write or start
 * a model call. A press that sent a request anyway (`sent`) isn't judged: the walk aborted it, so
 * its screen is a failed save, not what a learner sees.
 */
export type PressCoverage = {
  held: Record<"button" | "link" | "sent" | "submit", string[]>;
  pressed: string[];
};

/** A failing press or text drawn over text, with its faults and pictures, the moved boxes outlined. */
export type PressRecord = {
  after: string;
  before: string | null;
  control: string;
  faults: string[];
};

type Pending = { after: string | null; number: number; press: Press | null };

const PICTURE_DIGITS = 2;

/**
 * Judges the walk's presses on one page: each press against the screen before it, its undo
 * against the same screen, and every state it sees for text over text. A press inside what another
 * press opened (a choice in a dialog) is judged and undone before it, so presses stack.
 */
export function pressWalk(
  page: Page,
  { folder, reload }: { folder: string; reload: () => Promise<void> },
) {
  const coverage: PressCoverage = {
    held: { button: [], link: [], sent: [], submit: [] },
    pressed: [],
  };

  const findings: Finding[] = [];
  const records: PressRecord[] = [];
  const overlapsSeen = new Set<string>();
  const pending: Pending[] = [];
  let pictured = 0;

  async function picture(number: number, name: string, targetId: string) {
    await mkdir(folder, { recursive: true });
    const file = join(folder, `${String(number).padStart(PICTURE_DIGITS, "0")}-${name}.png`);
    await page.evaluate(showMarks, { on: true, targetId });
    await page.screenshot({ animations: "disabled", path: file, scale: "css" }).catch(() => null);
    await page.evaluate(showMarks, { on: false, targetId });
    return file;
  }

  /** Text over text on the screen as it is now, each pair reported once per load. */
  async function overlaps(state: string, targetId: string) {
    const found = findOverlaps(await page.evaluate(readTextLines)).filter(
      (overlap) => !overlapsSeen.has(`${overlap.a} | ${overlap.b}`),
    );

    if (found.length === 0) {
      return;
    }

    for (const overlap of found) {
      overlapsSeen.add(`${overlap.a} | ${overlap.b}`);
    }

    pictured += 1;

    await page.evaluate(
      markOverlaps,
      found.flatMap((overlap) => overlap.elements),
    );

    const shown = await picture(pictured, "overlap", targetId);

    // Only the overlap's marks: a press's moved boxes stay marked for its picture before.
    await page.evaluate(() => {
      for (const element of document.querySelectorAll<HTMLElement>("[data-zoonk-overlap]")) {
        delete element.dataset.zoonkOverlap;
      }
    });

    const faults = overlapFindings(found, state);
    findings.push(...faults);

    records.push({
      after: shown,
      before: null,
      control: state,
      faults: faults.map((fault) => fault.message),
    });
  }

  return {
    async begin(action: Action) {
      await page.evaluate(snapshotLayout, `press-${pending.length}`);
      coverage.pressed.push(controlName(action));
      return page.evaluate(readFrame);
    },
    coverage,
    findings,
    hold(action: Action) {
      if (action.effect) {
        coverage.held[action.effect].push(controlName(action));
      }
    },
    /** A press that left the page can't be judged; its undo is skipped too. */
    navigated() {
      pending.push({ after: null, number: 0, press: null });
    },
    overlaps,
    async pressed(
      action: Action,
      {
        before,
        comparison,
        doing,
        sent,
      }: { before: Frame; comparison: Comparison; doing: string; sent: boolean },
    ) {
      if (sent) {
        coverage.pressed.pop();
        coverage.held.sent.push(controlName(action));
        pending.push({ after: null, number: 0, press: null });
        return;
      }

      const press: Press = {
        action,
        doing,
        frames: { after: await page.evaluate(readFrame), before },
        pressed: {
          ...comparison,
          ...(await page.evaluate(readRegions, {
            controls: action.controls,
            from: `press-${pending.length}`,
          })),
        },
        undone: null,
      };

      const moves = pressMoves(press);
      const failing = pressFindings(press).some((finding) => finding.level === "fail");
      let after: string | null = null;

      if (failing) {
        pictured += 1;

        await page.evaluate(
          markMoved,
          moves.map((change) => comparison.moved.indexOf(change)),
        );

        after = await picture(pictured, "after", action.id);
      }

      pending.push({ after, number: pictured, press });
      await overlaps(`after ${doing} ${controlName(action)}`, action.id);
    },
    records,
    /** The snapshot the next undo is compared with: the screen before its press. */
    undoFrom: () => `press-${pending.length - 1}`,
    async undone(comparison: Comparison | null) {
      const last = pending.pop();

      if (!last?.press) {
        return;
      }

      const press = { ...last.press, undone: comparison };
      const faults = pressFindings(press);
      findings.push(...faults);

      // A press that failed isn't judged on its undo, but its picture before is taken only on the
      // screen it started from: an accordion that closed another section never gets it back.
      const restored = comparison !== null && restoreMoves(comparison).length === 0;

      if (last.after) {
        // Back on the screen before the press, the same elements outlined where they started.
        records.push({
          after: last.after,
          before: restored ? await picture(last.number, "before", press.action.id) : null,
          control: `${press.doing} ${controlName(press.action)}`,
          faults: faults.filter((fault) => fault.level === "fail").map((fault) => fault.message),
        });
      }

      await page.evaluate(showMarks, { clear: true, on: false, targetId: press.action.id });

      if (!restored) {
        await reload();
      }
    },
  };
}
