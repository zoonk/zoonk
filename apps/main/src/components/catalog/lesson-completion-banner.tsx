import { CircleCheck } from "lucide-react";
import { getExtracted } from "next-intl/server";

export async function LessonCompletionBanner() {
  const t = await getExtracted();

  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <CircleCheck aria-hidden="true" className="text-success size-4 shrink-0" />
      {t("All activities completed")}
    </p>
  );
}
