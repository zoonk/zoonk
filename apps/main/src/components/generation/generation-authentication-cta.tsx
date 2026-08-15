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
import { LogInIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** Explains why AI creation is unavailable while keeping the public course catalog accessible. */
export async function GenerationAuthenticationCTA<Href extends string>({
  loginHref,
}: {
  loginHref: AppRoute<Href>;
}) {
  const t = await getExtracted();

  return (
    <Empty className="border-0">
      <EmptyHeader align="start">
        <EmptyMedia variant="icon">
          <LogInIcon />
        </EmptyMedia>

        <EmptyTitle aria-level={1} role="heading">
          {t("Log in to create with AI")}
        </EmptyTitle>

        <EmptyDescription>
          {t(
            "You need to log in to create new courses and lessons with AI. You can explore existing courses without logging in.",
          )}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent align="stretch">
        <GenerationShortcutLink href="/courses" prefetch variant="outline">
          {t("Explore courses")}
        </GenerationShortcutLink>

        <GenerationShortcutLink href={loginHref}>{t("Log in")}</GenerationShortcutLink>
      </EmptyContent>
    </Empty>
  );
}
