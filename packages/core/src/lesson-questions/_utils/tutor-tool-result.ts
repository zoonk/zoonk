import { type TutorToolOffer } from "../tutor-tool-offer-contract";

type UnavailableReason =
  /** The goal already uses that country. */
  | "alreadySet"
  /** The goal's language doesn't list that country. */
  | "countryNotOffered"
  | "everythingFits"
  | "noMistakes"
  /** Includes tests lacking both source material and enough bank questions. */
  | "noMock"
  | "notExam"
  | "notLanguage"
  | "notCountryGoal"
  /** The exam has no written test to practice. */
  | "notWritten"
  | "nothingDue"
  /** No chapter has enough remaining lessons to offer a test-out. */
  | "nothingToSkip"
  /** The plan keeps one subject, so there's no focus to choose. */
  | "oneSubject"
  /** Offers unlock after a full chapter lesson or the next local day. */
  | "testFailedToday"
  | "unavailable";

export type TutorToolResult =
  | { offer: TutorToolOffer; status: "offered" }
  | { reason: UnavailableReason; status: "unavailable" }
  | { status: "notFound" | "unauthorized" };

export type TutorOfferAccess = "open" | "plusRequired";
