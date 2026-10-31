import { sendFromBrowser } from "@/lib/api/browser-api";
import { readCookie, setCookie } from "@zoonk/utils/cookies";
import { z } from "zod";

/** Holds the minimum age, so the message can say it again without asking. */
const AGE_STOP_COOKIE = "ZOONK_AGE_STOP";

/** A day, so a child can't take another year right away, as a neutral age screen needs. */
const AGE_STOP_SECONDS = 24 * 60 * 60;

/** `guestStarted`: the account exists now, so the question can no longer be skipped. */
export type BirthYearOutcome =
  | { status: "saved" }
  | { minimumAge: number; status: "belowMinimumAge" }
  | { guestStarted?: boolean; status: "blocked" | "failed" | "invalid" };

type Submit = (birthYear: number) => Promise<BirthYearOutcome>;

/** A visitor can still say no and leave nothing behind; an account answers to go on. */
export type BirthYearRequest =
  | { status: "closed" }
  | { signedIn: boolean; status: "asking"; submit: Submit }
  | { minimumAge: number; signedIn: boolean; status: "stopped" };

export type BirthYearAnswer = "blocked" | "cancelled" | "saved";

const CLOSED: BirthYearRequest = { status: "closed" };

let current: BirthYearRequest = CLOSED;
let finish: ((answer: BirthYearAnswer) => void) | null = null;
let savedHere = false;
let submitting = false;
const listeners = new Set<() => void>();

function show(next: BirthYearRequest) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToBirthYearRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBirthYearRequest(): BirthYearRequest {
  return current;
}

export function getServerBirthYearRequest(): BirthYearRequest {
  return CLOSED;
}

function readAgeStop(): number | null {
  const minimumAge = Number(readCookie(AGE_STOP_COOKIE));
  return Number.isInteger(minimumAge) && minimumAge > 0 ? minimumAge : null;
}

function close(answer: BirthYearAnswer) {
  savedHere ||= answer === "saved";
  finish?.(answer);
  finish = null;
  show(CLOSED);
}

/** Closes a visitor's question, or their stop, with nothing started; never mid-submit. */
export function cancelBirthYear(): void {
  if (!submitting && current.status !== "closed" && !current.signedIn) {
    close("cancelled");
  }
}

/** Called by the dialog; keeps it open on a failure so the learner can try again. */
export async function submitBirthYear({
  birthYear,
  signedIn,
  submit,
}: {
  birthYear: number;
  signedIn: boolean;
  submit: Submit;
}): Promise<BirthYearOutcome> {
  submitting = true;

  const outcome = await submit(birthYear).finally(() => {
    submitting = false;
  });

  if ("guestStarted" in outcome && outcome.guestStarted && current.status === "asking") {
    show({ ...current, signedIn: true });
  }

  if (outcome.status === "belowMinimumAge") {
    void setCookie(AGE_STOP_COOKIE, String(outcome.minimumAge), { maxAge: AGE_STOP_SECONDS });
    show({ minimumAge: outcome.minimumAge, signedIn, status: "stopped" });
  } else if (outcome.status === "saved" || outcome.status === "blocked") {
    close(outcome.status);
  }

  return outcome;
}

/**
 * Asks once and resolves when the year is saved, the visitor said no, or the guest couldn't start.
 * Below the minimum age, a signed-in learner's never resolves: they can only log out.
 */
export function askBirthYear({
  signedIn,
  submit,
}: {
  signedIn: boolean;
  submit: Submit;
}): Promise<BirthYearAnswer> {
  const minimumAge = readAgeStop();

  const request: BirthYearRequest = minimumAge
    ? { minimumAge, signedIn, status: "stopped" }
    : { signedIn, status: "asking", submit };

  return new Promise((resolve) => {
    finish = resolve;
    show(request);
  });
}

/** For an account that hasn't given its year; the request a new guest is making goes first. */
export function askLearnerOnce(): Promise<BirthYearAnswer> | null {
  return current.status === "closed" && !savedHere
    ? askBirthYear({ signedIn: true, submit: saveBirthYear })
    : null;
}

export async function saveBirthYear(birthYear: number): Promise<BirthYearOutcome> {
  const response = await sendFromBrowser({
    body: { birthYear },
    method: "PUT",
    path: "/v1/me/birth-year",
  });

  if (!response) {
    return { status: "failed" };
  }

  if (response.ok) {
    return { status: "saved" };
  }

  return readRefusal(response);
}

const refusalSchema = z.object({
  error: z.object({ code: z.string(), details: z.object({ minimumAge: z.int() }).nullish() }),
});

async function readRefusal(response: Response): Promise<BirthYearOutcome> {
  const { data } = refusalSchema.safeParse(await response.json().catch(() => null));
  const minimumAge = data?.error.details?.minimumAge;

  if (data?.error.code === "BELOW_MINIMUM_AGE" && minimumAge) {
    return { minimumAge, status: "belowMinimumAge" };
  }

  return { status: data?.error.code === "INVALID_BIRTH_YEAR" ? "invalid" : "failed" };
}
