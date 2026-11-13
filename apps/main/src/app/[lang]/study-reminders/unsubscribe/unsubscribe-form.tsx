"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { BellOffIcon, MailCheckIcon, MailXIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { turnOffStudyReminderEmailAction } from "./actions";

type Result = Awaited<ReturnType<typeof turnOffStudyReminderEmailAction>>;

function ManageRemindersLink() {
  const t = useExtracted();

  return (
    <Link
      className={buttonVariants({ size: "lg", variant: "outline" })}
      href={getMenu("reminders").url}
      prefetch={false}
    >
      {t("Manage reminders")}
    </Link>
  );
}

function UnsubscribeResult({ result }: { result: Result }) {
  const t = useExtracted();
  const off = result === "off";

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {off ? <MailCheckIcon aria-hidden="true" /> : <MailXIcon aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>
          <h1>{off ? t("Email reminders are off") : t("This link is no longer active")}</h1>
        </EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <ManageRemindersLink />
      </EmptyContent>
    </Empty>
  );
}

/** Opening the link changes nothing: mail scanners open links too, so only the button turns email off. */
export function UnsubscribeForm({ token }: { token: string | null }) {
  const t = useExtracted();
  const [result, setResult] = useState<Result | null>(token ? null : "invalid");
  const [isPending, startTransition] = useTransition();

  const turnOff = () =>
    startTransition(async () => {
      const { data } = await safeAsync(() => turnOffStudyReminderEmailAction(token));
      setResult(data);

      if (!data) {
        showErrorToast(t("That didn't save. Try again."));
      }
    });

  if (result) {
    return <UnsubscribeResult result={result} />;
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BellOffIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          <h1>{t("Turn off email reminders?")}</h1>
        </EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <form action={() => turnOff()} className="contents">
          <Button
            busy={isPending}
            icon={<BellOffIcon aria-hidden="true" />}
            size="lg"
            type="submit"
          >
            {t("Turn off")}
          </Button>
        </form>
      </EmptyContent>
    </Empty>
  );
}
