import { CheckIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function ActivityIndicator({ completed }: { completed: boolean }) {
  const t = await getExtracted();

  if (completed) {
    return (
      <div
        aria-label={t("Completed")}
        className="bg-success/60 text-background flex size-3.5 shrink-0 items-center justify-center rounded-full"
        role="img"
      >
        <CheckIcon aria-hidden="true" className="size-3" />
      </div>
    );
  }

  return (
    <div
      aria-label={t("Not completed")}
      className="border-muted-foreground/30 size-3.5 shrink-0 rounded-full border-2"
      role="img"
    />
  );
}
