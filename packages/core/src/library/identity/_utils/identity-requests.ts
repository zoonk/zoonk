import { type LibraryIdentitySubject } from "@zoonk/ai/tasks/v2/identity/subject";
import { type CourseLevel } from "@zoonk/db";
import { type TextSearch } from "./text-search-sql";

type IdentityRequestBase = {
  language: string;
  /** Only the general part of the goal; personal details never reach shared content. */
  goal?: string | null;
  ownerId?: string | null;
};

export type CourseIdentityRequest = IdentityRequestBase & {
  kind: "course";
  targetLanguage: string | null;
  title: string;
};

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
  course: IdentityCourse | null;
  level: CourseLevel;
  targetLanguage: string | null;
  title: string;
  description: string;
  skills: { id: string; name: string }[];
  sharesSkills?: boolean;
  newSkills?: boolean;
};

export type SkillIdentityRequest = IdentityRequestBase & {
  kind: "skill";
  targetLanguage: string | null;
  name: string;
  description: string;
  course?: string | null;
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
  prompt: string;
  hasLabels: boolean;
  textAllowed: boolean;
};

export type LibraryIdentityRequest =
  | ChapterIdentityRequest
  | CourseIdentityRequest
  | ImageIdentityRequest
  | LessonIdentityRequest
  | SkillIdentityRequest
  | SourceIdentityRequest;

export type IdentityKindSearch = {
  identityKey: string;
  baseTerms: string[];
  aiSubject: LibraryIdentitySubject;
  findExact: () => Promise<string | null>;
  findCandidateIds: (search: TextSearch) => Promise<string[]>;
};
