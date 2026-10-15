"use client";

import { checkIdentity } from "@/lib/learner/learner-identity";
import { isJsonObject } from "@zoonk/utils/json";
import { type CourseProgress } from "./course-progress-contract";

/**
 * Answers by learner and address, held for the tab's life: a page shown again starts from what it
 * showed last while it reads again.
 */
const progressByKey = new Map<string, CourseProgress>();
const pendingKeys = new Set<string>();

/** A page shown again while its earlier read was out: one fresh read follows that one. */
const rereadKeys = new Set<string>();

const listeners = new Set<() => void>();

export function subscribeToCourseProgress(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** The answer read for `key` (a learner, their sign-in and an address), or null until there's one. */
export function getCourseProgress(key: string | null): CourseProgress | null {
  return key ? (progressByKey.get(key) ?? null) : null;
}

function toProgress(body: unknown): CourseProgress | null {
  return isJsonObject(body) &&
    typeof body.followsCourse === "boolean" &&
    typeof body.lessonStarted === "boolean"
    ? { followsCourse: body.followsCourse, lessonStarted: body.lessonStarted }
    : null;
}

/**
 * A failed read keeps what the page shows (the visitor's version, or the last answer). A read asked
 * for while the same one is out runs again once it settles, so a page shown again gets an answer
 * read after its show, not one from before it. It's sent and kept only while the page belongs to
 * the learner the browser holds: the key names the learner the page knew, and the cookies of now
 * say whose answer comes back.
 */
export async function readCourseProgress({ key, url }: { key: string; url: string }) {
  if (pendingKeys.has(key)) {
    rereadKeys.add(key);
    return;
  }

  if (!checkIdentity()) {
    return;
  }

  pendingKeys.add(key);

  const progress = await fetch(url, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then(toProgress, () => null);

  pendingKeys.delete(key);

  // Read while someone else's session arrived: nothing of it is kept, and no read follows.
  if (!checkIdentity()) {
    rereadKeys.delete(key);
    return;
  }

  if (progress) {
    progressByKey.set(key, progress);
    listeners.forEach((listener) => listener());
  }

  if (rereadKeys.delete(key)) {
    void readCourseProgress({ key, url });
  }
}
