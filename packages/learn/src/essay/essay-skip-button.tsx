"use client";

import { Button } from "@zoonk/ui/components/button";
import { SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type useFinishEssay } from "./use-finish-essay";

/** Leaves the essay as it is: the same second action while writing and after a grade. */
export function EssaySkipButton({ finishing }: { finishing: ReturnType<typeof useFinishEssay> }) {
  const t = useExtracted();

  return (
    <Button
      busy={finishing.pending}
      className="shrink-0"
      icon={<SkipForwardIcon aria-hidden="true" />}
      onClick={() => void finishing.finish()}
      size="xl"
      variant="outline"
    >
      {t("Skip")}
    </Button>
  );
}
