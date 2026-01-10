"use client";

import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { checkCourseStatus, startCourseGeneration } from "./actions";

type GenerateCourseFormProps = {
  courseSuggestionId: number;
  description: string;
  locale: string;
  title: string;
};

export function GenerateCourseForm({
  courseSuggestionId,
  description,
  locale,
  title,
}: GenerateCourseFormProps) {
  const t = useExtracted();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const hasStarted = useRef(false);

  // Auto-start generation when component mounts
  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    async function generate() {
      try {
        // Start the workflow (this also creates the course optimistically)
        const result = await startCourseGeneration({
          courseSuggestionId,
          locale,
          title,
        });

        // Poll for course completion
        const poll = async () => {
          const status = await checkCourseStatus({
            locale,
            slug: result.slug,
          });

          if (status.status === "completed") {
            startTransition(() => {
              router.push(`/b/ai/c/${encodeURIComponent(result.slug)}`);
            });
            return;
          }

          // Keep polling until course is completed
          setTimeout(poll, 2000);
        };

        // Start polling
        await poll();
      } catch (err) {
        console.error("Course generation failed:", err);
        setError(t("Failed to generate course. Please try again."));
      }
    }

    void generate();
  }, [courseSuggestionId, locale, title, router, t]);

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerTitle className="flex items-center gap-2">
          <SparklesIcon aria-hidden="true" className="size-5" />
          {t("Generating course")}
        </ContainerTitle>
      </ContainerHeader>

      <ContainerBody className="flex flex-col gap-6">
        <div>
          <h2 className="font-semibold text-lg">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>

        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : (
          <div className="flex items-center gap-3">
            <Loader2Icon
              aria-hidden="true"
              className="size-5 animate-spin text-muted-foreground"
            />
            <p className="text-muted-foreground text-sm">
              {t("This may take a minute...")}
            </p>
          </div>
        )}
      </ContainerBody>
    </Container>
  );
}
