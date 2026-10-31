import { type TutorToolOffer } from "../contract";

type UnavailableReason =
  /** Includes a one-subject plan where there is no depth choice. */
  | "everythingFits"
  | "noMistakes"
  /** Includes tests lacking both source material and enough bank questions. */
  | "noMock"
  | "notExam"
  | "notLanguage"
  /** The exam has no written test to practice. */
  | "notWritten"
  | "nothingDue"
  /** No chapter has enough remaining lessons to offer a test-out. */
  | "nothingToSkip"
  /** Offers unlock after a full chapter lesson or the next local day. */
  | "testFailedToday"
  | "unavailable";

export type TutorToolResult =
  | { offer: TutorToolOffer; status: "offered" }
  | { reason: UnavailableReason; status: "unavailable" }
  | { status: "notFound" | "unauthorized" };

export type TutorOfferAccess = "open" | "plusRequired";
