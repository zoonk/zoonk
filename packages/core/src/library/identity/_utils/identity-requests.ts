import { type LibraryIdentitySubject } from "@zoonk/ai/tasks/v2/identity/subject";
import { type CourseLevel } from "@zoonk/db";
import { type TextSearch } from "./text-search-sql";

type IdentityRequestBase = {
  /** The content language. */
  language: string;
  /** Only the general part of the goal; personal details never reach shared content. */
  goal?: string | null;
  /**
   * The learner a private course is for. Private requests only match their
   * owner's own rows and never reuse or become shared content.
   */
  ownerId?: string | null;
};

/** A course is a whole subject: its title names it, and it spans every level band. */
export type CourseIdentityRequest = IdentityRequestBase & {
  kind: "course";
  targetLanguage: string | null;
  title: string;
};

/**
 * The course a chapter or lesson is written for. Its id scopes exact matches to that course; its
 * title tells the reuse decision which subject the item teaches, since the same title or skills
 * teach different content in another subject.
 */
export type IdentityCourse = { id: string; title: string };

export type ChapterIdentityRequest = IdentityRequestBase & {
  kind: "chapter";
  course: IdentityCourse;
  level: CourseLevel;
  targetLanguage: string | null;
  title: string;
  description: string;
  objectives: string[];
};

export type LessonIdentityRequest = IdentityRequestBase & {
  kind: "lesson";
  /** Null only for a lesson outside any course, such as a part split from a setup lesson. */
  course: IdentityCourse | null;
  level: CourseLevel;
  targetLanguage: string | null;
  title: string;
  description: string;
  /** The 1 to 3 skills the lesson teaches, already resolved to Library skills. */
  skills: { id: string; name: string }[];
  /**
   * Another lesson resolved with this one teaches the same skills: its outline split one skill set
   * into several lessons, so the title tells them apart (see `buildLessonIdentityKey`).
   */
  sharesSkills?: boolean;
};

export type SkillIdentityRequest = IdentityRequestBase & {
  kind: "skill";
  targetLanguage: string | null;
  name: string;
  description: string;
};

export type SourceIdentityRequest = IdentityRequestBase & {
  kind: "source";
  url: string | null;
  contentHash: string | null;
  title: string;
  publisher: string | null;
};

export type ImageIdentityRequest = IdentityRequestBase & {
  kind: "image";
  /** The scene in English, as `describeImageScene` writes it. */
  prompt: string;
  styleVersion: number;
  /** Whether the new image carries labels in `language`. One without text serves every language. */
  hasLabels: boolean;
  /** Language courses show no text, so only images without text can serve them. */
  textAllowed: boolean;
};

export type LibraryIdentityRequest =
  | ChapterIdentityRequest
  | CourseIdentityRequest
  | ImageIdentityRequest
  | LessonIdentityRequest
  | SkillIdentityRequest
  | SourceIdentityRequest;

/** What the shared identity flow needs from each kind of Library item. */
export type IdentityKindSearch = {
  identityKey: string;
  /** The item's own words, searched with the model's terms so an exact wording always matches. */
  baseTerms: string[];
  /** Its `language` is the language search terms are written and stemmed in. */
  aiSubject: LibraryIdentitySubject;
  findExact: () => Promise<string | null>;
  /** The ids of rows whose words match the search, best first; they load with their kind's loader. */
  findCandidateIds: (search: TextSearch) => Promise<string[]>;
};
