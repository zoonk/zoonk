import { relative } from "node:path";
import { chromium } from "@playwright/test";
import { type LoadReport } from "./measure.mts";
import { type ViewportName } from "./viewports.mts";

/** A phone, a tablet and a laptop: where a press's faults have shown so far. */
export const PRESS_VIEWPORTS: readonly ViewportName[] = ["phone", "tablet", "laptop"];

/**
 * Headless Chromium hides scrollbars, and on macOS draws them over the page, so a scroll lock that
 * takes the scrollbar away would never show. This one draws classic scrollbars, as Windows and a
 * Mac with a mouse do, so a press that adds or removes one moves the page here too.
 */
export async function launchPressBrowser() {
  return chromium.launch({
    args: ["--disable-features=OverlayScrollbar"],
    ignoreDefaultArgs: ["--hide-scrollbars"],
  });
}

/** Per page and size: how many presses, what was only held and why, and each failing press with its pictures. */
export function pressSection(loads: LoadReport[], out: string): string[] {
  const walked = loads.filter((load) => load.walk?.presses);

  if (walked.length === 0) {
    return [];
  }

  return [
    "## Presses",
    "",
    "Every control that stays on the page was pressed and undone: choices, switches, tabs, disclosures, menus, dialogs and panel toggles. Writes are aborted, so nothing is saved or generated. Links, submit buttons and other buttons are only held (hovered and pressed with the click swallowed): a link would leave the page, and a button may write or start a model call. A still picture can't show a press, so this is what covers one. In each picture the pressed control is outlined in dashed blue and what moved in red, before and after the press.",
    "",
    ...walked.flatMap((load) => {
      const coverage = load.walk?.presses;
      const records = load.pressRecords ?? [];

      if (!coverage) {
        return [];
      }

      const held = [
        coverage.held.link.length > 0 ? `${coverage.held.link.length} links (leave the page)` : "",
        coverage.held.submit.length > 0
          ? `submit buttons (send a form): ${coverage.held.submit.join(", ")}`
          : "",
        coverage.held.sent.length > 0
          ? `pressed but sent a request the walk blocked, so not judged (it may save or start a model call): ${coverage.held.sent.join(", ")}`
          : "",
        coverage.held.button.length > 0
          ? `other buttons (may write or start a model call): ${coverage.held.button.join(", ")}`
          : "",
      ].filter(Boolean);

      return [
        `### ${load.path} · ${load.viewport}: ${coverage.pressed.length} pressed, ${records.length} failing`,
        "",
        ...(coverage.pressed.length > 0
          ? [`Pressed: ${[...new Set(coverage.pressed)].join(", ")}.`, ""]
          : []),
        ...(held.length > 0 ? [`Held, not clicked: ${held.join("; ")}.`, ""] : []),
        ...records.flatMap((record) => [
          `- **${record.control}**`,
          ...record.faults.map((fault) => `  - ${fault}`),
          `  - pictures: ${[record.before, record.after]
            .filter((file) => file !== null)
            .map((file) => relative(out, file))
            .join(", ")}`,
        ]),
        ...(records.length > 0 ? [""] : []),
      ];
    }),
  ];
}
