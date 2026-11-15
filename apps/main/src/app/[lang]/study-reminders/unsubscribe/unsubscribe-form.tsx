"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { EnterButton, EnterLink } from "@zoonk/learn/enter-button";
import { TaskStopMessage } from "@zoonk/learn/task-layout";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { showErrorToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { BellOffIcon, MailCheckIcon, MailXIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { turnOffStudyReminderEmailAction } from "./actions";

type Result = Awaited<ReturnType<typeof turnOffStudyReminderEmailAction>>;

/** The page's one message, at the top of its column; its action is the bottom bar's. */
function Message({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <TaskStopMessage heading="h1" icon={icon} title={title} />
    </div>
  );
}

function UnsubscribeResult({ result }: { result: Result }) {
  const t = useExtracted();
  const off = result === "off";

  return (
    <>
      <Message
        icon={off ? <MailCheckIcon aria-hidden="true" /> : <MailXIcon aria-hidden="true" />}
        title={off ? t("Email reminders are off") : t("This link is no longer active")}
      />

      <BottomBar>
        <BottomBarActions>
          <EnterLink href={getMenu("reminders").url} link={Link} prefetch={false}>
            {t("Manage reminders")}
          </EnterLink>
        </BottomBarActions>
      </BottomBar>
    </>
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
    <>
      <Message icon={<BellOffIcon aria-hidden="true" />} title={t("Turn off email reminders")} />

      <form action={() => turnOff()} className="contents">
        <BottomBar>
          <BottomBarActions>
            <EnterButton busy={isPending} type="submit">
              {t("Turn off")}
            </EnterButton>
          </BottomBarActions>
        </BottomBar>
      </form>
    </>
  );
}
