import "server-only";
import { type LessonScope } from "@zoonk/core/lessons/scope";
import { type NextLesson, getNextLessonResource } from "@zoonk/core/progress/get-next-lesson";
import { NextResponse } from "next/server";
import { errors } from "../api-errors";

/**
 * Converts Core's web-oriented route slug into the public organization field
 * and marks every target variant explicitly for reliable client narrowing.
 */
function serializeNextLessonTarget(target: NextLesson) {
  const { brandSlug, ...fields } = target;

  if ("lessonId" in fields) {
    return { ...fields, organizationSlug: brandSlug, type: "lesson" as const };
  }

  return { ...fields, organizationSlug: brandSlug, type: "chapter" as const };
}

/**
 * Resolves and serializes the scope shared by the course, chapter, and lesson resource routes.
 */
export async function handleNextLesson({ scope }: { scope: LessonScope }) {
  const result = await getNextLessonResource({ scope });

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (!result.target) {
    return NextResponse.json({ completed: false, hasStarted: false, type: "empty" });
  }

  return NextResponse.json(serializeNextLessonTarget(result.target));
}
