import { type ReadStudyDay } from "../../../sessions/_utils/read-study-day";
import { getSelectedCatchUpItems } from "../../../sessions/_utils/selected-day-plan";
import { type DayView } from "../../../sessions/day-view";

export function listEarlierWork({
  day,
  session,
}: {
  day: ReadStudyDay;
  session: DayView;
}): { id: string | null; title: string }[] {
  if (!day.selection) {
    return [];
  }

  const taught = new Set(
    session.blocks
      .flatMap((block) => (block.kind === "learn" ? [block.planItemId, block.lessonId] : []))
      .filter((id) => id !== null),
  );

  return getSelectedCatchUpItems(day.selection).flatMap((item) =>
    taught.has(item.id ?? "") || taught.has(item.lessonId ?? "")
      ? []
      : [{ id: item.id, title: item.titleSnapshot }],
  );
}
