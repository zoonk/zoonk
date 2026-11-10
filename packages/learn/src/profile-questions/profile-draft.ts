import {
  type ProfileAnswerInput,
  type ProfileQuestionView,
  profileAnswerInputSchema,
} from "@zoonk/core/profile/questions/contract";

export type ProfileQuestion = ProfileQuestionView["id"];

export type ChipQuestion = "tools" | "watch" | "listen" | "play" | "read" | "activities";

const MAX_PROFILE_PICKS = 3;

/** The exclusive rows, each of which declines the question. */
export type ProfileExclusive = "none" | "nothing" | "nothingInParticular" | "ratherNot";

type ProfileStudyDraft = { field: string; subject: string };

export type ProfileDraft = {
  picks: string[];
  text: string;
  studies: ProfileStudyDraft[];
  exclusive: ProfileExclusive | null;
  consented: boolean;
};

const CHIP_QUESTIONS = new Set<ProfileQuestion>([
  "tools",
  "watch",
  "listen",
  "play",
  "read",
  "activities",
]);

const JOB_STATUSES = new Set(["work", "workAndStudy"]);

const NO_SOUND_EFFECTS = "noSoundEffects";

/** Which supports often help with each condition, checked when the supports screen follows. */
const PRECHECKS: Partial<Record<string, string[]>> = {
  adhd: ["stepByStep", "shortAnswers", "shorterDays"],
  autism: ["plainWords", "stepByStep", NO_SOUND_EFFECTS],
  dyscalculia: ["stepByStep", "examplesFirst"],
  dyslexia: ["shortAnswers"],
};

function isChipQuestion(question: ProfileQuestion): boolean {
  return CHIP_QUESTIONS.has(question);
}

export function getDeclineExclusive(question: ProfileQuestion): ProfileExclusive {
  switch (question) {
    case "work":
    case "conditions":
      return "ratherNot";
    case "studies":
      return "nothing";
    case "learningSupport":
      return "nothingInParticular";
    case "tools":
    case "watch":
    case "listen":
    case "play":
    case "read":
    case "activities":
      return "none";
    default:
      return question satisfies never;
  }
}

function emptyProfileDraft(): ProfileDraft {
  return { consented: false, exclusive: null, picks: [], studies: [], text: "" };
}

export function toProfileDraft(view: ProfileQuestionView): ProfileDraft {
  const studies = view.saved.studies.map((study) => ({
    field: study.field,
    subject: study.subject ?? "",
  }));

  const hasSaved = view.saved.picks.length > 0 || view.saved.text !== "" || studies.length > 0;

  return {
    consented: view.id === "conditions" && view.saved.picks.length > 0,
    exclusive: view.status === "declined" && !hasSaved ? getDeclineExclusive(view.id) : null,
    picks: view.saved.picks,
    studies,
    text: view.saved.text,
  };
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

/** `capped` is true when the pick was refused because the screen already holds three. */
export function toggleProfilePick({
  draft,
  id,
  question,
}: {
  draft: ProfileDraft;
  id: string;
  question: ProfileQuestion;
}): { capped: boolean; draft: ProfileDraft } {
  if (question === "work") {
    return { capped: false, draft: { ...draft, exclusive: null, picks: [id] } };
  }

  if (question === "studies") {
    const picked = draft.studies.some((study) => study.field === id);

    if (!picked && draft.studies.length >= MAX_PROFILE_PICKS) {
      return { capped: true, draft };
    }

    return {
      capped: false,
      draft: {
        ...draft,
        exclusive: null,
        studies: picked
          ? draft.studies.filter((study) => study.field !== id)
          : [...draft.studies, { field: id, subject: "" }],
      },
    };
  }

  const picked = draft.picks.includes(id);

  if (!picked && isChipQuestion(question) && draft.picks.length >= MAX_PROFILE_PICKS) {
    return { capped: true, draft };
  }

  const picks = picked ? draft.picks.filter((pick) => pick !== id) : [...draft.picks, id];

  return {
    capped: false,
    draft: {
      ...draft,
      consented: question === "conditions" && picks.length > 0 && draft.consented,
      exclusive: null,
      picks,
    },
  };
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
      return draft.picks.length > 0;
    case "learningSupport":
    case "tools":
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

  if (question === "conditions" && draft.consented) {
    return !draft.picks.includes("other") || draft.text.trim() !== "";
  }

  return true;
}

/**
 * Onboarding sends a screen only once it holds an answer; Settings saves an empty screen as
 * declined, but never conditions picked without consent.
 */
export function canSendProfileDraft({
  draft,
  from,
  question,
}: {
  draft: ProfileDraft;
  from: "onboarding" | "settings";
  question: ProfileQuestion;
}): boolean {
  if (!isComplete({ draft, question })) {
    return false;
  }

  if (from === "onboarding") {
    return hasContent({ draft, question });
  }

  return question !== "conditions" || draft.picks.length === 0 || draft.consented;
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
      return draft.consented
        ? {
            conditions: draft.picks.map((condition) => ({
              condition,
              note: condition === "other" ? text || null : null,
            })),
            consented: true,
          }
        : { declined: true };
    case "learningSupport":
      return {
        needs: draft.picks.filter((pick) => pick !== NO_SOUND_EFFECTS),
        note: text || null,
        soundEffects: !draft.picks.includes(NO_SOUND_EFFECTS),
      };
    case "tools":
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

/** An empty or exclusive screen declines; unconsented conditions never leave the device. */
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
