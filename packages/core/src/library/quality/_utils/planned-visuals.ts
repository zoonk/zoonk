import { type LessonScreen } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type LessonVisualKind } from "@zoonk/ai/tasks/lesson-spec/visuals";
import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { findMarkdownTables } from "@zoonk/utils/markdown-table";
import { normalizeString } from "@zoonk/utils/string";
import { checkWrittenExplore } from "../../steps/written-screens";
import { getScreenTexts } from "./screen-texts";

const DRAWN_ON_THEIR_OWN = new Set<WrittenScreen["kind"]>(["activity", "mathCheck", "typedAnswer"]);

function readTables(screen: WrittenScreen): string[] {
  return getScreenTexts(screen).flatMap((piece) =>
    findMarkdownTables(piece.text).map((table) =>
      normalizeString(JSON.stringify([table.header, table.rows])),
    ),
  );
}

type VisualInput = { explores: boolean; screen: WrittenScreen; specScreen: LessonScreen };

function describeExploreIssues(screen: WrittenScreen): string {
  if (screen.kind !== "explanation" || !screen.explore) {
    return "";
  }

  const checked = checkWrittenExplore(screen.explore);
  return checked.ok ? "" : ` Its fields don't pass: ${checked.issues.join("; ")}.`;
}

function showsDrawing({ screen, specScreen }: VisualInput): boolean {
  return "visual" in screen && screen.visual?.kind === specScreen.visualKind;
}

const SHOWS_PLANNED: Readonly<Record<LessonVisualKind, (input: VisualInput) => boolean>> = {
  chart: showsDrawing,
  none: () => true,
  picture: ({ screen }) => "image" in screen && screen.image !== null,
  table: ({ screen }) => readTables(screen).length > 0,
  template: ({ explores, screen }) => screen.kind !== "explanation" || explores,
  timeline: showsDrawing,
};

export function findMissingPlannedVisual(input: VisualInput): string | null {
  const { specScreen } = input;

  if (DRAWN_ON_THEIR_OWN.has(input.screen.kind) || SHOWS_PLANNED[specScreen.visualKind](input)) {
    return null;
  }

  if (specScreen.visualKind === "template") {
    return `The plan shows the ${String(specScreen.activityTemplate)} template to explore on this screen, but it shows none.${describeExploreIssues(input.screen)} Write its fields so they pass.`;
  }

  return `The plan shows a ${specScreen.visualKind} on this screen, but it shows none. Add it with the brief's data.`;
}

function readTemplate(screen: WrittenScreen): string | null {
  if (screen.kind === "activity") {
    return screen.template;
  }

  return screen.kind === "explanation" && screen.explore ? screen.explore.template : null;
}

function readVisuals(screen: WrittenScreen): string[] {
  const template = readTemplate(screen);
  return [...readTables(screen), ...(template ? [`template:${template}`] : [])];
}

type RepeatedVisual = { screen: number; template: string | null };

/** The same template counts as repeated whatever its model, an explore then an activity included. */
export function findRepeatedVisuals(screens: readonly WrittenScreen[]): RepeatedVisual[] {
  const visuals = screens.map((screen) => readVisuals(screen));

  return screens.flatMap((screen, index) => {
    const previous = new Set(visuals[index - 1]);
    const repeated = visuals[index]?.find((visual) => previous.has(visual));

    return repeated ? [{ screen: index, template: readTemplate(screen) }] : [];
  });
}
