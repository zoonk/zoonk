import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/playable-lesson";
import { rightAnswer } from "./preview-answers";

export type PreviewState = "answering" | "checked" | "explore" | "reading";

export type PreviewEntry = {
  group: string;
  id: string;
  label: string;
  screen: (state: PreviewState) => PlayableLibraryStep;
  states: readonly PreviewState[];
};

function previewId(entryId: string): string {
  return `preview-${entryId}`;
}

function statesOf(screen: PlayableLibraryStep): readonly PreviewState[] {
  if (rightAnswer(screen)) {
    return ["answering", "checked"];
  }

  const asks = "exercise" in screen || screen.kind === "activity" || screen.kind === "spokenAnswer";
  return asks ? ["answering"] : ["reading"];
}

export function entry({
  explore,
  group,
  id,
  label,
  screen,
}: Omit<PreviewEntry, "screen" | "states"> & {
  explore?: (id: string) => PlayableLibraryStep;
  screen: (id: string) => PlayableLibraryStep;
}): PreviewEntry {
  const build = (state: PreviewState) =>
    state === "explore" && explore ? explore(previewId(id)) : screen(previewId(id));

  const states = statesOf(build("answering"));
  return { group, id, label, screen: build, states: explore ? ["explore", ...states] : states };
}
