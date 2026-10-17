import { type InstrumentWaitlistEntry } from "@zoonk/db";
import { type InstrumentWaitlistEntryView } from "../instrument-waitlist-contract";

export function toInstrumentWaitlistEntryView(
  entry: InstrumentWaitlistEntry,
): InstrumentWaitlistEntryView {
  return {
    id: entry.id,
    instrument: entry.instrument,
    joinedAt: entry.createdAt.toISOString(),
    language: entry.language,
  };
}
