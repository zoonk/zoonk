"use client";

import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

type CourseGeneratingProps = {
  course: {
    title: string;
  };
};

export function CourseGenerating({ course }: CourseGeneratingProps) {
  const t = useExtracted();
  const router = useRouter();

  // Auto-refresh the page every few seconds to check if generation is complete
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Container variant="narrow">
        <ContainerHeader>
          <ContainerTitle className="flex items-center gap-2">
            <SparklesIcon aria-hidden="true" className="size-5" />
            {t("Generating course")}
          </ContainerTitle>
        </ContainerHeader>

        <ContainerBody className="flex flex-col gap-6">
          <div>
            <h2 className="font-semibold text-lg">{course.title}</h2>
          </div>

          <div className="flex items-center gap-3">
            <Loader2Icon
              aria-hidden="true"
              className="size-5 animate-spin text-muted-foreground"
            />
            <p className="text-muted-foreground text-sm">
              {t("This may take a minute...")}
            </p>
          </div>
        </ContainerBody>
      </Container>
    </main>
  );
}
