import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

export async function ActivityNotGenerated({
  activityId,
  locale,
}: {
  activityId: bigint;
  locale: string;
}) {
  const t = await getExtracted();

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{t("Activity not available")}</EmptyTitle>

        <EmptyDescription>{t("This activity hasn't been generated yet.")}</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/${locale}/generate/a/${activityId}`}
          prefetch={false}
          rel="nofollow"
        >
          <SparklesIcon data-icon="inline-start" />
          {t("Generate activity")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
