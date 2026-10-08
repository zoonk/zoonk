"use client";

import { type SpeakingMockExam } from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { MicIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { GenerationWait } from "../../generation/generation-wait";
import { useSpeakingMockTitle } from "../conversation/conversation-labels";
import { useCallStart } from "../conversation/use-call-start";
import { LanguageCard, LanguageCardTitle } from "../language-card";

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
 * The speaking mock of the exam the goal prepares for (IELTS or TOEFL iBT): a short test with an
 * examiner, then an estimated band per criterion. The host starts the call and opens it; false
 * means it didn't. A mock is usually written ahead and opens at once; when it isn't, the card shows
 * it being written until it opens.
 */
export function SpeakingMockCard({
  exam,
  onStart,
}: {
  exam: SpeakingMockExam;
  onStart: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const title = useSpeakingMockTitle();
  const description = useSpeakingMockDescription();
  const call = useCallStart({ onStart, step: "writeMock" });

  return (
    <LanguageCard aria-labelledby="language-speaking-mock">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-2xl"
        >
          <MicIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <LanguageCardTitle id="language-speaking-mock">{title(exam)}</LanguageCardTitle>
          <p className="text-muted-foreground text-sm">{description(exam)}</p>
        </div>
      </div>

      {call.run ? (
        <GenerationWait className="pt-2" kind="speakingMock" run={call.run}>
          {call.run.status !== "failed" && (
            <p className="text-muted-foreground text-sm">
              {t("Your mock opens as soon as it's ready.")}
            </p>
          )}
        </GenerationWait>
      ) : (
        <>
          <Button className="self-start" disabled={call.isStarting} onClick={call.start}>
            {call.isStarting ? t("Starting…") : t("Start the mock")}
          </Button>

          {call.failed && (
            <p className="text-destructive text-sm" role="alert">
              {t("The mock didn't start. Try again in a moment.")}
            </p>
          )}
        </>
      )}
    </LanguageCard>
  );
}
