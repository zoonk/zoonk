"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
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
      className={buttonVariants({ variant: "outline" })}
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
        {off && (
          <EmptyDescription>
            {t("Your other reminder settings haven't changed. You'll still get sign-in codes.")}
          </EmptyDescription>
        )}
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
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const turnOff = () =>
    startTransition(async () => {
      const { data } = await safeAsync(() => turnOffStudyReminderEmailAction(token));
      setFailed(!data);
      setResult(data);
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
        <Button busy={isPending} icon={<BellOffIcon aria-hidden="true" />} onClick={turnOff}>
          {t("Turn off")}
        </Button>
        {failed && (
          <p className="text-destructive-text text-sm" role="alert">
            {t("That didn't save. Try again.")}
          </p>
        )}
      </EmptyContent>
    </Empty>
  );
}
