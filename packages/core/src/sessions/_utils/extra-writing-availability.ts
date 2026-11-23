import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { readExtraWritingLimit } from "../../learner/facts/extra-writing";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { readBlockPayload } from "../block-payload";
import { type StudyBlockView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

export async function loadExtraWritingAvailability({
  blocks,
  now,
  timeZone,
  userId,
}: {
  blocks: StudySessionRow["blocks"];
  now: Date;
  timeZone: string;
  userId: string;
}) {
  const extraWriting = new Set(
    blocks.flatMap((block) => {
      const { extra, writing } = readBlockPayload(block);

      return extra && writing && !writing.admissionId && block.status === "pending"
        ? [block.id]
        : [];
    }),
  );

  const today = getDateInTimeZone({ date: now, timeZone });

  const limit =
    extraWriting.size > 0 ? await readExtraWritingLimit(userId, toIsoDate(today)) : null;

  return (block: StudyBlockView): StudyBlockView =>
    limit && extraWriting.has(block.id)
      ? { ...block, writingAvailability: { returnsOn: limit.returnsOn, status: "tomorrow" } }
      : block;
}
