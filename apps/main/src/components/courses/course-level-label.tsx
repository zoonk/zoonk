import { type CourseLevel } from "@zoonk/db";
import { getExtracted } from "next-intl/server";

export async function CourseLevelLabel({ level }: { level: CourseLevel | null }) {
  const t = await getExtracted();

  if (level === "overview") {
    return t("Overview");
  }

  if (level === "basic") {
    return t("Basic");
  }

  if (level === "intermediate") {
    return t("Intermediate");
  }

  if (level === "advanced") {
    return t("Advanced");
  }

  if (level === "a1") {
    return t("A1 · Getting started");
  }

  if (level === "a2") {
    return t("A2 · Everyday conversations");
  }

  if (level === "b1") {
    return t("B1 · Independent conversations");
  }

  if (level === "b2") {
    return t("B2 · Expressing complex ideas");
  }

  if (level === "c1") {
    return t("C1 · Flexible, fluent expression");
  }

  if (level === "c2") {
    return t("C2 · Nuanced communication");
  }

  return t("Your learning path");
}
