import { Badge } from "@zoonk/ui/components/badge";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 p-4 pb-28">
      <div className="flex flex-col items-start gap-4">
        <Badge variant="secondary">{t("Coming soon")}</Badge>

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance md:text-5xl">
            {t("Pass an exam")}
          </h1>
          <p className="text-muted-foreground text-pretty">
            {t(
              "Exam prep is not available yet. Tell us what you're preparing for and we'll notify you when it launches.",
            )}
          </p>
        </div>
      </div>

      <ExamWaitlistForm />
    </main>
  );
}
