"use client";

import { type SpeakingMockExam } from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { PhoneOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../../_components/kind-tile";
import {
  NoticeCard,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardTitle,
} from "../../_components/notice-card";
import { GenerationWait } from "../../generation/generation-wait";
import { useSpeakingMockTitle } from "../conversation/conversation-labels";
import { useCallStart } from "../conversation/use-call-start";

function useSpeakingMockDescription() {
  const t = useExtracted();

  const descriptions: Record<SpeakingMockExam, string> = {
    ielts: t(
      "A short speaking test with an examiner. After it, an estimated band for each criterion.",
    ),
    toefl: t(
      "Repeat sentences, then a short interview with an examiner. After it, an estimated band from 1 to 6 for each criterion.",
    ),
  };

  return (exam: SpeakingMockExam) => descriptions[exam];
}

/**
 * The speaking mock of the exam the goal prepares for (IELTS or TOEFL iBT), flat on its page or
 * sheet with the conversation kind's dot: a short test with an examiner, then an estimated band per
 * criterion. The host starts the call and opens it; false means it didn't. A mock is usually
 * written ahead and opens at once; when it isn't, the card shows it being written until it opens.
 */
export function SpeakingMockCard({
  exam,
  onStart,
  paused,
}: {
  exam: SpeakingMockExam;
  onStart: () => Promise<boolean>;
  paused: boolean;
}) {
  const t = useExtracted();
  const title = useSpeakingMockTitle();
  const description = useSpeakingMockDescription();
  const call = useCallStart({ onStart, step: "writeMock" });

  return (
    <section aria-labelledby="language-speaking-mock" className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <KindDot className="-translate-y-px" kind="conversation" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[0.9375rem] font-medium" id="language-speaking-mock">
            {title(exam)}
          </h2>
          <p className="text-muted-foreground text-[0.8125rem]">{description(exam)}</p>
        </div>
      </div>

      {paused && (
        <NoticeCard>
          <PhoneOffIcon aria-hidden="true" />
          <NoticeCardContent>
            <NoticeCardTitle>{t("Calls are paused")}</NoticeCardTitle>
            <NoticeCardDescription>
              {t("It's the same for everyone right now. Try again later.")}
            </NoticeCardDescription>
          </NoticeCardContent>
        </NoticeCard>
      )}

      {!paused &&
        (call.run ? (
          <GenerationWait className="pt-2" kind="speakingMock" run={call.run}>
            {call.run.status !== "failed" && (
              <p className="text-muted-foreground text-sm">
                {t("Your mock opens as soon as it's ready.")}
              </p>
            )}
          </GenerationWait>
        ) : (
          <>
            <Button
              className="self-start"
              disabled={call.isStarting}
              onClick={call.start}
              size="lg"
              variant="outline"
            >
              {call.isStarting ? t("Starting…") : t("Start the mock")}
            </Button>

            {call.failed && (
              <p className="text-destructive-text text-sm" role="alert">
                {t("The mock didn't start. Try again in a moment.")}
              </p>
            )}
          </>
        ))}
    </section>
  );
}
