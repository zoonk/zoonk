import { type LessonScreen } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type LessonVisualKind } from "@zoonk/ai/tasks/lesson-spec/visuals";
import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { findMarkdownTables } from "@zoonk/utils/markdown-table";
import { normalizeString } from "@zoonk/utils/string";
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

/** The plan chose each screen's visual to teach its idea, so a written screen without it loses it. */
export function findMissingPlannedVisual(input: VisualInput): string | null {
  const { specScreen } = input;

  if (DRAWN_ON_THEIR_OWN.has(input.screen.kind) || SHOWS_PLANNED[specScreen.visualKind](input)) {
    return null;
  }

  const shown =
    specScreen.visualKind === "template"
      ? `the ${String(specScreen.activityTemplate)} template to explore, with valid fields`
      : `a ${specScreen.visualKind}`;

  return `The plan shows ${shown} on this screen, but it shows none. Add it with the brief's data.`;
}

/** Screens whose table is the same one the screen before showed. */
export function findRepeatedTables(screens: readonly WrittenScreen[]): number[] {
  const tables = screens.map((screen) => readTables(screen));

  return screens.flatMap((_, index) => {
    const previous = new Set(tables[index - 1]);
    return tables[index]?.some((table) => previous.has(table)) ? [index] : [];
  });
}
