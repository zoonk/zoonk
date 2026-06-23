import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import {
  StartSurface,
  StartSurfaceBadge,
  StartSurfaceContent,
  StartSurfaceDescription,
  StartSurfaceHeader,
  StartSurfaceTitle,
} from "../_components/start-surface";
import { ExamWaitlistForm } from "./exam-waitlist-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Online AI exam prep for certifications and tests. Hands-on explanation and practice questions to help you pass your exam.",
    ),
    title: t("Online AI Exam Prep"),
  };
}

/**
 * Presents the unavailable exam-prep path with a low-friction waitlist instead
 * of sending learners into a course flow that cannot serve them yet.
 */
export default async function StartExam() {
  const t = await getExtracted();

  return (
    <StartSurface>
      <StartSurfaceHeader>
        <StartSurfaceBadge>{t("Coming soon")}</StartSurfaceBadge>

        <StartSurfaceContent>
          <StartSurfaceTitle>{t("Pass an exam")}</StartSurfaceTitle>
          <StartSurfaceDescription>
            {t(
              "Exam prep is not available yet. Tell us what you're preparing for and we'll notify you when it launches.",
            )}
          </StartSurfaceDescription>
        </StartSurfaceContent>
      </StartSurfaceHeader>

      <ExamWaitlistForm />
    </StartSurface>
  );
}
