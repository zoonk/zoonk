/** What the call's ending hears: the same events on web, Apple and Android. */
export type CallEndingEvent =
  | { at: number; startMs: number; type: "characterSpoke" }
  /** The learner's own words came back as a transcript: they spoke, about 1.5 s before. */
  | { at: number; type: "learnerHeard" }
  /** A microphone sample: `speaking` already holds the platform's hangover. */
  | { at: number; speaking: boolean; type: "speech" }
  | { at: number; type: "typing" }
  | { at: number; type: "sent" }
  | { at: number; id: string; startMs: number | null; type: "acknowledged" }
  /** An objective check's answer for the transcript as it was at `snapshotAt`. */
  | {
      allMet: boolean;
      at: number;
      goodbye: boolean;
      progress: boolean;
      snapshotAt: number;
      type: "checked";
    }
  | { at: number; type: "tick" };
