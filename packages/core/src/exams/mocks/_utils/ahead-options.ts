import { type MockOption } from "../mock-options";
import { MAX_EXAM_QUESTIONS } from "../mock-structure";
import { mockPaperKey } from "./mock-supply-request";

/** However many papers a notice lists, the ones nobody asked for are written ahead up to one exam's worth. */
export function listAheadOptions({
  askedKey,
  options,
}: {
  askedKey: string | null;
  options: readonly MockOption[];
}): MockOption[] {
  return options.reduce<{ kept: MockOption[]; room: number }>(
    ({ kept, room }, option) => {
      if (mockPaperKey(option) === askedKey) {
        return { kept: [...kept, option], room };
      }

      return option.questions <= room
        ? { kept: [...kept, option], room: room - option.questions }
        : { kept, room };
    },
    { kept: [], room: MAX_EXAM_QUESTIONS },
  ).kept;
}
