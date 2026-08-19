import { GenerationShortcutLink } from "@/components/generation/generation-shortcut-link";
import { type AppRoute } from "@/i18n/navigation";
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
import { SubscriptionGateTracker } from "./subscription-gate-tracker";

/**
 * Preserves one tracked subscription action while allowing a calling page to
 * provide durable context that is more useful than the generic Plus message.
 */
export async function UpgradeCTA<BackHref extends string, FreeLessonHref extends string = string>({
  backHref,
  backLabel,
  children,
  freeLessonHref,
}: {
  backHref: AppRoute<BackHref>;
  backLabel: string;
  children?: React.ReactNode;
  freeLessonHref?: AppRoute<FreeLessonHref>;
}) {
  const t = await getExtracted();

  return (
    <Empty className="border-0">
      <SubscriptionGateTracker />

      {children ?? (
        <EmptyHeader align="start">
          <EmptyMedia variant="icon">
            <SparklesIcon />
          </EmptyMedia>

          <EmptyTitle>{t("Keep learning with Plus")}</EmptyTitle>

          <EmptyDescription>
            {t("Plus gives you unlimited courses and lessons for whatever you want to learn.")}
          </EmptyDescription>
        </EmptyHeader>
      )}

      <EmptyContent align="stretch" className="gap-2">
        <GenerationShortcutLink href="/subscription" prefetch shortcut="Enter">
          {t("Subscribe")}
        </GenerationShortcutLink>

        {freeLessonHref && (
          <GenerationShortcutLink href={freeLessonHref} prefetch variant="outline">
            {t("Try free chapter")}
          </GenerationShortcutLink>
        )}

        <GenerationShortcutLink
          className="text-muted-foreground mt-1 w-fit max-w-full self-center px-2"
          href={backHref}
          prefetch
          shortcut="Esc"
          variant="ghost"
        >
          {backLabel}
        </GenerationShortcutLink>
      </EmptyContent>
    </Empty>
  );
}
