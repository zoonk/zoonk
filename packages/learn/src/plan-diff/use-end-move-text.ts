import { useFormatFinishDate } from "../_components/finish-sentence";
import { isNearEstimate, useIsoToday } from "../_utils/iso-date";
import { getShownEndMove } from "./end-move";

export function useEndMoveText() {
  const formatDate = useFormatFinishDate();
  const today = useIsoToday();

  return function endMoveText(effect: Parameters<typeof getShownEndMove>[0]) {
    const end = getShownEndMove(effect);

    if (!effect || !end) {
      return null;
    }

    const { endPrecisionAfter, endPrecisionBefore } = effect;

    const day =
      endPrecisionAfter === "month" &&
      endPrecisionBefore === "month" &&
      isNearEstimate({ date: end.after, today }) &&
      isNearEstimate({ date: end.before, today });

    const after = formatDate(end.after, day ? "day" : endPrecisionAfter);
    const before = formatDate(end.before, day ? "day" : endPrecisionBefore);

    return after === before ? null : { after, before, day };
  };
}
