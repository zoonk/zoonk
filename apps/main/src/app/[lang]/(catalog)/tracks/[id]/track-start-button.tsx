"use client";

import { runClientAction } from "@/lib/client-action";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted, useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { startTrack } from "./track-actions";

export function TrackStartButton({
  trackId,
  hasStarted,
}: {
  trackId: string;
  hasStarted: boolean;
}) {
  const t = useExtracted();
  const language = useLocale();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string>();

  return (
    <div className="flex flex-col gap-3">
      <Button
        aria-busy={pending}
        className="min-h-11 w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setStatus(undefined);

            const result = await runClientAction(() => startTrack({ language, trackId }), {
              status: "unavailable" as const,
            });

            setStatus(result.status);
          })
        }
      >
        {pending && <Spinner aria-hidden="true" />}
        {hasStarted ? t("Continue learning") : t("Start learning")}
      </Button>
      {status && (
        <p className="text-muted-foreground text-sm" role="status">
          <TrackStartMessage status={status} />
        </p>
      )}
    </div>
  );
}

function TrackStartMessage({ status }: { status: string }) {
  const t = useExtracted();

  if (status === "completed") {
    return t(
      "You've finished the selected paths in this track. Revisit a course or choose a new path below.",
    );
  }

  if (status === "limitReached") {
    return t(
      "You've reached your limit for preparing new courses. Your track is saved. You can still open a course below.",
    );
  }

  return t("We couldn't open your next step. Please try again.");
}
