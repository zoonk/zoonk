import { type LessonScreen } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type LessonVisualKind } from "@zoonk/ai/tasks/lesson-spec/visuals";
import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { type MarkdownTable, findMarkdownTables } from "@zoonk/utils/markdown-table";
import { normalizeString } from "@zoonk/utils/string";
import { checkWrittenExplore } from "../../steps/written-screens";
import { getScreenTexts } from "./screen-texts";

const DRAWN_ON_THEIR_OWN = new Set<WrittenScreen["kind"]>(["activity", "mathCheck", "typedAnswer"]);

const TEACHING_KINDS = new Set<WrittenScreen["kind"]>(["explanation", "workedExample"]);

function findScreenTables(screen: WrittenScreen): MarkdownTable[] {
  return getScreenTexts(screen).flatMap((piece) => findMarkdownTables(piece.text));
}

export function showsTable(screen: WrittenScreen): boolean {
  return findScreenTables(screen).some((table) => table.rows.length > 0);
}

function readTables(screen: WrittenScreen): string[] {
  return findScreenTables(screen).map((table) =>
    normalizeString(JSON.stringify([table.header, table.rows])),
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
  table: ({ screen }) => showsTable(screen),
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

type RepeatedKind = "columns" | "table" | "template";
type Visual = { key: string; kind: RepeatedKind };

function readVisuals(screen: WrittenScreen): Visual[] {
  const template = readTemplate(screen);

  const columns = TEACHING_KINDS.has(screen.kind)
    ? findScreenTables(screen).map((table) => normalizeString(JSON.stringify(table.header)))
    : [];

  return [
    ...readTables(screen).map((table) => ({ key: `table:${table}`, kind: "table" as const })),
    ...columns.map((header) => ({ key: `columns:${header}`, kind: "columns" as const })),
    ...(template ? [{ key: `template:${template}`, kind: "template" as const }] : []),
  ];
}

export type RepeatedVisual = { kind: RepeatedKind; screen: number; template: string | null };

/**
 * The same template counts as repeated whatever its model, an explore then an activity included, and
 * so does a table with the same columns on the next teaching screen: it teaches by the same layout.
 */
export function findRepeatedVisuals(screens: readonly WrittenScreen[]): RepeatedVisual[] {
  const visuals = screens.map((screen) => readVisuals(screen));

  return screens.flatMap((screen, index) => {
    const previous = new Set(visuals[index - 1]?.map((visual) => visual.key));
    const repeated = visuals[index]?.find((visual) => previous.has(visual.key));

    return repeated ? [{ kind: repeated.kind, screen: index, template: readTemplate(screen) }] : [];
  });
}
