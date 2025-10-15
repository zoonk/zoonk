"use client";

import { Alert, AlertTitle } from "@zoonk/ui/components/alert";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/client";

export function ProtectedSection({
  children,
}: React.ComponentProps<"section">) {
  const { data: session, isPending } = authClient.useSession();
  const t = useTranslations("Protected");

  if (isPending) {
    return (
      <Item variant="muted" className="max-w-xs">
        <ItemMedia>
          <Spinner />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{t("checkingLogin")}</ItemTitle>
        </ItemContent>
      </Item>
    );
  }

  if (!session) {
    return (
      <section className="flex max-w-md flex-col gap-4">
        <Alert className="max-w-max">
          <LockIcon />
          <AlertTitle>{t("requiresLogin")}</AlertTitle>
        </Alert>

        <Link href="/login" className={cn(buttonVariants(), "w-max")}>
          {t("login")}
        </Link>
      </section>
    );
  }

  return children;
}
