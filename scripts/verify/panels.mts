import { type Page } from "@playwright/test";
import { type Finding } from "./checks.mts";
import { focusReturned, readPanel } from "./keys-probe.mts";
import { OVERLAYS, OVERLAY_SELECTOR } from "./overlays.mts";

/** Whatever floats over the page and closes on Esc: a shared overlay, a dialog, a menu or a list box. */
export const OVERLAY =
  `${OVERLAY_SELECTOR}, [role=dialog], [role=alertdialog], [role=menu], [role=listbox]`
    .split(", ")
    .map((selector) => `${selector}:visible`)
    .join(", ");

/** Closes what floats over the page with Esc, and says whether there was one. */
export async function closeOverlay(page: Page) {
  if ((await page.locator(OVERLAY).count()) > 0) {
    await page.keyboard.press("Escape");
    return true;
  }

  return false;
}

export type PanelFacts = NonNullable<ReturnType<typeof readPanel>> & { focusBack: boolean | null };

const DIM_TOLERANCE = 0.01;
const FOOTER_PADDING = 16;

function behavior(id: string, message: string, fails = false): Finding {
  return { check: `Behavior: ${id}`, level: fails ? "fail" : "warn", message };
}

/** Craft B1 and B2 in a panel: its one main action answers Enter as soon as it opens. */
function panelEnterFindings({ enter, label }: PanelFacts): Finding[] {
  if (!enter) {
    return [];
  }

  const main = enter.bound.join(", ");

  return [
    ...enter.unmarked.map((control) =>
      behavior(
        "Enter",
        `${label} draws ${control} filled, but Enter doesn't press it and it shows no ⏎: draw its main action with EnterButton, or say Enter must not press it (enter="off")`,
      ),
    ),
    ...(enter.takenBy
      ? [behavior("Enter", `${label} opens on ${enter.takenBy}, so Enter presses that instead of ${main}`)]
      : []),
    ...(enter.bound.length > 1
      ? [behavior("Enter", `two main actions answer Enter in ${label}: ${main}`)]
      : []),
  ];
}

/** Focus, closing behavior and responsive placement for a panel opened by the walk. */
export function panelFindings(panel: PanelFacts): Finding[] {
  return [
    ...(panel.shared
      ? []
      : [
          behavior(
            "panel piece",
            `${panel.label} uses a dialog role outside the shared overlay pieces; panel behavior is not measured`,
          ),
        ]),
    ...(panel.focusInside === false
      ? [behavior("panels", `${panel.label} opened without taking focus`, true)]
      : []),
    ...(panel.needsClose && !panel.closeDrawn
      ? [behavior("panels", `${panel.label} has no ✕ and no button to leave by`, true)]
      : []),
    ...(panel.centered === false
      ? [behavior("panels", `${panel.label} isn't centered on a laptop, or shows its handle`, true)]
      : []),
    ...(panel.shared && panel.focusBack === false
      ? [
          behavior(
            "panels",
            `${panel.label} didn't close on Esc and give focus back to what opened it`,
            true,
          ),
        ]
      : []),
    ...(panel.dim &&
    (panel.dim.actual === null ||
      Math.abs(panel.dim.actual - panel.dim.expected) > DIM_TOLERANCE ||
      panel.dim.blur !== "none")
      ? [
          behavior(
            "B4 overlay dim",
            `${panel.label} backdrop reads ${panel.dim.actual === null ? "no black dim" : `${Math.round(panel.dim.actual * 100)}% black`} with ${panel.dim.blur}; expected ${Math.round(panel.dim.expected * 100)}% black and no blur`,
          ),
        ]
      : []),
    ...(panel.edge &&
    (panel.edge.drawn !== panel.edge.expected || panel.edge.padding !== FOOTER_PADDING)
      ? [
          behavior(
            "B4 sheet footer edge",
            `${panel.label} has ${panel.edge.drawn ? "a" : "no"} content edge where ${panel.edge.expected ? "one" : "none"} is expected, and ${panel.edge.padding} px above its footer; expected 16 px`,
          ),
        ]
      : []),
    ...panelEnterFindings(panel),
    ...(panel.sheet === false
      ? [
          behavior(
            "B4 phone sheets",
            `${panel.label} opens away from the bottom on a phone, where what opens over a page is a sheet`,
          ),
        ]
      : []),
  ];
}

async function finishAnimations(page: Page) {
  await page.evaluate(async (overlays) => {
    const selector = overlays
      .flatMap(({ panel, backdrop }) => [panel, backdrop])
      .map((slot) => `[data-slot=${slot}]`)
      .join(", ");

    await Promise.all(
      [...document.querySelectorAll(selector)]
        .flatMap((node) => node.getAnimations())
        .map((animation) => animation.finished.catch(() => null)),
    );
  }, OVERLAYS);
}

export async function inspectPanel(page: Page, phone: boolean, opener: string) {
  await finishAnimations(page);
  return page.evaluate(readPanel, { opener, overlays: OVERLAYS, phone });
}

export async function focusCameBack(page: Page, opener: string, returnTo?: string) {
  await finishAnimations(page);
  return page.evaluate(focusReturned, { opener, returnTo });
}
