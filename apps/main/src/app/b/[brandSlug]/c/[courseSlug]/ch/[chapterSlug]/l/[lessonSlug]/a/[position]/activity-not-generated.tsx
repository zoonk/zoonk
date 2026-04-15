import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

export async function ActivityNotGenerated({
  activityId,
  brandSlug,
}: {
  activityId: bigint;
  brandSlug: string;
}) {
  const t = await getExtracted();
  const canGenerateActivity = brandSlug === AI_ORG_SLUG;

  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SparklesIcon />
        </EmptyMedia>

        <EmptyTitle>{t("Activity not available")}</EmptyTitle>

        <EmptyDescription>{t("This activity hasn't been created yet.")}</EmptyDescription>
      </EmptyHeader>

      {canGenerateActivity && (
        <EmptyContent>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/generate/a/${activityId}`}
            prefetch={false}
            rel="nofollow"
          >
            <SparklesIcon data-icon="inline-start" />
            {t("Create activity")}
          </Link>
        </EmptyContent>
      )}
    </Empty>
  );
}
