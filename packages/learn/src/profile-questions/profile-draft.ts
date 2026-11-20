import {
  MAX_PROFILE_FAVORITES_LENGTH,
  MAX_PROFILE_JOB_LENGTH,
  type ProfileAnswerInput,
  type ProfileQuestionView,
  profileAnswerInputSchema,
} from "@zoonk/core/profile/questions/contract";
import { splitProfileFavorites } from "@zoonk/core/profile/questions/favorites";

export type ProfileQuestion = ProfileQuestionView["id"];

export type ChipQuestion = "tools" | "watch" | "listen" | "play" | "read" | "activities";

/**
 * The row that declines a pick-one question in Settings, the only way to take a pick back there. A
 * question with several picks declines by saving none, and onboarding's Skip declines any question.
 */
export type ProfileExclusive = "ratherNot";

type ProfileStudyDraft = { field: string; subject: string };

export type ProfileDraft = {
  picks: string[];
  /** What's in the text field; on the tools question, what's typed and not added yet. */
  text: string;
  /** The tools question's typed tools, each shown as its own chip. */
  typed: string[];
  studies: ProfileStudyDraft[];
  exclusive: ProfileExclusive | null;
};

const TYPED_SEPARATOR = ", ";

const JOB_STATUSES = new Set(["work", "workAndStudy"]);

const NO_SOUND_EFFECTS = "noSoundEffects";

/** Which supports often help with each condition, checked when the supports screen follows. */
const PRECHECKS: Partial<Record<string, string[]>> = {
  adhd: ["stepByStep", "shortAnswers", "shorterDays"],
  autism: ["plainWords", "stepByStep", NO_SOUND_EFFECTS],
  dyscalculia: ["stepByStep", "examplesFirst"],
  dyslexia: ["shortAnswers"],
};

function getDeclineExclusive(question: ProfileQuestion): ProfileExclusive | null {
  switch (question) {
    case "work":
    case "addressForm":
      return "ratherNot";
    case "conditions":
    case "studies":
    case "learningSupport":
    case "tools":
    case "watch":
    case "listen":
    case "play":
    case "read":
    case "activities":
      return null;
    default:
      return question satisfies never;
  }
}

function emptyProfileDraft(): ProfileDraft {
  return { exclusive: null, picks: [], studies: [], text: "", typed: [] };
}

export function getProfileJobPrefill(role: string | null): string | null {
  return role?.trim().slice(0, MAX_PROFILE_JOB_LENGTH) || null;
}

export function toProfileDraft(view: ProfileQuestionView): ProfileDraft {
  const studies = view.saved.studies.map((study) => ({
    field: study.field,
    subject: study.subject ?? "",
  }));

  const hasSaved = view.saved.picks.length > 0 || view.saved.text !== "" || studies.length > 0;

  const typed = view.id === "tools" ? splitProfileFavorites(view.saved.text) : [];

  return {
    exclusive: view.status === "declined" && !hasSaved ? getDeclineExclusive(view.id) : null,
    picks: view.saved.picks,
    studies,
    text: view.id === "tools" ? "" : view.saved.text,
    typed,
  };
}

/** How many more characters the tools field takes before the typed tools reach the saved limit. */
export function getTypedToolsRoom(typed: readonly string[]): number {
  const used = typed.length === 0 ? 0 : typed.join(TYPED_SEPARATOR).length + TYPED_SEPARATOR.length;
  return Math.max(0, MAX_PROFILE_FAVORITES_LENGTH - used);
}

/**
 * Turns the tools field's text into chips and empties it. A name an offered chip already has picks
 * that chip, a name already typed is left out, and a name that would pass the limit is dropped.
 */
export function addTypedTools({
  draft,
  options,
}: {
  draft: ProfileDraft;
  options: ProfileQuestionView["options"];
}): ProfileDraft {
  const picks = [...draft.picks];
  const typed = [...draft.typed];

  for (const name of splitProfileFavorites(draft.text)) {
    const key = name.toLowerCase();
    const offered = options.find((option) => option.label.toLowerCase() === key);
    const fits = [...typed, name].join(TYPED_SEPARATOR).length <= MAX_PROFILE_FAVORITES_LENGTH;

    if (offered && !picks.includes(offered.id)) {
      picks.push(offered.id);
    } else if (!offered && fits && !typed.some((tool) => tool.toLowerCase() === key)) {
      typed.push(name);
    }
  }

  return { ...draft, exclusive: null, picks, text: "", typed };
}

export function getPrecheckedSupports(conditions: readonly string[]): string[] {
  return [...new Set(conditions.flatMap((condition) => PRECHECKS[condition] ?? []))];
}

export function withPrecheckedSupports({
  conditions,
  draft,
}: {
  conditions: readonly string[];
  draft: ProfileDraft;
}): ProfileDraft {
  return { ...draft, picks: [...new Set([...draft.picks, ...getPrecheckedSupports(conditions)])] };
}

export function toggleProfilePick({
  draft,
  id,
  question,
}: {
  draft: ProfileDraft;
  id: string;
  question: ProfileQuestion;
}): ProfileDraft {
  if (question === "work" || question === "addressForm") {
    return { ...draft, exclusive: null, picks: [id] };
  }

  if (question === "studies") {
    const picked = draft.studies.some((study) => study.field === id);

    return {
      ...draft,
      exclusive: null,
      studies: picked
        ? draft.studies.filter((study) => study.field !== id)
        : [...draft.studies, { field: id, subject: "" }],
    };
  }

  const picked = draft.picks.includes(id);
  const picks = picked ? draft.picks.filter((pick) => pick !== id) : [...draft.picks, id];

  return { ...draft, exclusive: null, picks };
}

/** Picking an exclusive row clears the screen; picking it again clears it too. */
export function toggleProfileExclusive({
  draft,
  exclusive,
}: {
  draft: ProfileDraft;
  exclusive: ProfileExclusive;
}): ProfileDraft {
  return { ...emptyProfileDraft(), exclusive: draft.exclusive === exclusive ? null : exclusive };
}

function hasContent({
  draft,
  question,
}: {
  draft: ProfileDraft;
  question: ProfileQuestion;
}): boolean {
  if (draft.exclusive) {
    return true;
  }

  switch (question) {
    case "studies":
      return draft.studies.length > 0;
    case "work":
    case "conditions":
    case "addressForm":
      return draft.picks.length > 0;
    case "tools":
      return draft.picks.length > 0 || draft.typed.length > 0;
    case "learningSupport":
    case "watch":
    case "listen":
    case "play":
    case "read":
    case "activities":
      return draft.picks.length > 0 || draft.text.trim() !== "";
    default:
      return question satisfies never;
  }
}

function isComplete({ draft, question }: { draft: ProfileDraft; question: ProfileQuestion }) {
  if (question === "studies") {
    return draft.studies.every((study) => study.field !== "other" || study.subject.trim() !== "");
  }

  if (question === "conditions") {
    return !draft.picks.includes("other") || draft.text.trim() !== "";
  }

  return true;
}

/** Where a question is asked: in onboarding, or again from Settings › About you. */
export type ProfileQuestionPlace = "onboarding" | "settings";

export function canSendProfileDraft({
  draft,
  from,
  question,
  savedStatus,
}: {
  draft: ProfileDraft;
  from: ProfileQuestionPlace;
  question: ProfileQuestion;
  savedStatus?: ProfileQuestionView["status"];
}): boolean {
  if (!isComplete({ draft, question })) {
    return false;
  }

  return (from === "settings" && savedStatus === "answered") || hasContent({ draft, question });
}

function toAnswer({
  draft,
  question,
}: {
  draft: ProfileDraft;
  question: ProfileQuestion;
}): Record<string, unknown> {
  const text = draft.text.trim();

  switch (question) {
    case "work": {
      const status = draft.picks[0] ?? null;
      return { job: status && JOB_STATUSES.has(status) ? text || null : null, status };
    }
    case "studies":
      return {
        studies: draft.studies.map((study) => ({
          field: study.field,
          subject: study.subject.trim() || null,
        })),
      };
    case "conditions":
      return {
        conditions: draft.picks.map((condition) => ({
          condition,
          note: condition === "other" ? text || null : null,
        })),
        consented: true,
      };
    case "addressForm":
      return { form: draft.picks[0] ?? null };
    case "learningSupport":
      return {
        needs: draft.picks.filter((pick) => pick !== NO_SOUND_EFFECTS),
        note: text || null,
        soundEffects: !draft.picks.includes(NO_SOUND_EFFECTS),
      };
    case "tools":
      return { favorites: draft.typed.join(TYPED_SEPARATOR), picks: draft.picks };
    case "watch":
    case "listen":
    case "play":
    case "read":
    case "activities":
      return { favorites: text, picks: draft.picks };
    default:
      return question satisfies never;
  }
}

/** What onboarding's Skip saves: the question is declined, so the next goal doesn't ask it again. */
export function declineProfileQuestion(question: ProfileQuestion): ProfileAnswerInput {
  return profileAnswerInputSchema.parse({ answer: { declined: true }, question });
}

/** An empty or exclusive screen declines. */
export function toProfileAnswer({
  draft,
  memoryEnabled,
  question,
}: {
  draft: ProfileDraft;
  memoryEnabled: boolean;
  question: ProfileQuestion;
}): ProfileAnswerInput | null {
  // The note field is hidden while memory is off, so a note saved before stays as it is.
  if (question === "learningSupport" && !memoryEnabled) {
    return toProfileAnswer({ draft: { ...draft, text: "" }, memoryEnabled: true, question });
  }

  const declined = !hasContent({ draft, question }) || draft.exclusive !== null;

  const answer = declined
    ? { declined: true, ...(question === "learningSupport" ? { soundEffects: true } : {}) }
    : toAnswer({ draft, question });

  const parsed = profileAnswerInputSchema.safeParse({ answer, question });
  return parsed.success ? parsed.data : null;
}

/** The draft a screen sends: text left in the tools field counts as added, so it's never lost. */
export function toSentDraft({
  draft,
  question,
}: {
  draft: ProfileDraft;
  question: ProfileQuestionView;
}): ProfileDraft {
  return question.id === "tools" ? addTypedTools({ draft, options: question.options }) : draft;
}

/** What a screen's Continue or Save sends, or null while it can't send. */
export function toProfileInput({
  draft,
  from,
  memoryEnabled,
  question,
}: {
  draft: ProfileDraft;
  from: ProfileQuestionPlace;
  memoryEnabled: boolean;
  question: ProfileQuestionView;
}): ProfileAnswerInput | null {
  const sent = toSentDraft({ draft, question });

  return canSendProfileDraft({
    draft: sent,
    from,
    question: question.id,
    savedStatus: question.status,
  })
    ? toProfileAnswer({ draft: sent, memoryEnabled, question: question.id })
    : null;
}
