import { type TutorToolOffer } from "../contract";

/** Why a feature can't be offered right now, for the buddy to say what helps instead. */
type UnavailableReason =
  /** The plan's time covers every subject in depth, or it has one subject: nothing to choose. */
  | "everythingFits"
  /** No mistake is waiting to be fixed. */
  | "noMistakes"
  /** No mock can be built yet: a class test with no material and few questions in the bank. */
  | "noMock"
  /** The goal isn't an exam: mock exams copy an exam's. */
  | "notExam"
  /** The goal isn't a language: practice calls and pronunciation are a language's. */
  | "notLanguage"
  /** The goal's exam has no written test (an essay) to practise. */
  | "notWritten"
  /** No mispronounced word is due to be said again. */
  | "nothingDue"
  /** No chapter ahead has enough lessons a test could skip (or the area has none left). */
  | "nothingToSkip"
  /** A new goal needs words to start from. */
  | "unavailable";

export type TutorToolResult =
  | { offer: TutorToolOffer; status: "offered" }
  | { reason: UnavailableReason; status: "unavailable" }
  | { status: "notFound" | "unauthorized" };

export type TutorOfferAccess = "open" | "plusRequired";
