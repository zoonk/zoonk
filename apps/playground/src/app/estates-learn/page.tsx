"use client";

import { CheckpointCallPreparing } from "@zoonk/learn/language/checkpoint-call";
import { PronunciationReviewScreen } from "@zoonk/learn/language/pronunciation";
import { type FollowedRunProps, GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
import { LearnProvider } from "@zoonk/learn/provider";
import { SpeechPlayerProvider, type VoiceText } from "@zoonk/learn/speech/provider";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CallProblem } from "../../../../../packages/learn/src/language/conversation/call-problem";
import { AlphabetRow } from "../../../../../packages/learn/src/language/units/alphabet-row";
import { PreviewIntlProvider } from "../preview/preview-intl-provider";

// Temporary page for the UX review pack (lane E): real screens, hand-built states. Not committed.

const ADAPTERS: any = {
  analytics: { track: () => null },
  linkComponent: ({ children, className, href }: any) => (
    <a className={className} href={href} onClick={(event) => event.preventDefault()}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "#", journey: "#", signUp: "#", today: "#", upgrade: "#" },
};

const CALL_STEP = "writeCall";

const noVoice: VoiceText = () => Promise.resolve({ limit: null, status: "failed" });
const never = () => new Promise<never>(() => {});

const WORDS = [
  { audioUrl: null, id: "00000000-0000-7000-8000-000000000001", respelling: "iu-TÍ-li-tiz", romanization: null, tip: null, word: "utilities" },
  { audioUrl: null, id: "00000000-0000-7000-8000-000000000002", respelling: "LÉND-lord", romanization: null, tip: null, word: "landlord" },
];

function State() {
  const state = useSearchParams().get("state") ?? "";

  if (state.startsWith("call-")) {
    return (
      <CallProblem
        error={state.replace("call-", "") as any}
        exitHref="/"
        limit={null}
        onRetry={() => null}
        onTakeover={() => null}
        title="Practice call"
      />
    );
  }

  if (state === "checkpoint" || state === "checkpoint-wait") {
    return (
      <CheckpointCallPreparing
        exitHref="/"
        onStart={state === "checkpoint" ? never : async () => ({ generationId: "estate-run" })}
        unitTitle="Renting an apartment"
      />
    );
  }

  if (state === "alphabet") {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
        <AlphabetRow
          alphabet={{ href: "#", minutes: 5, pending: true, title: "Hiragana" }}
          onSkip={async () => true}
        />
      </main>
    );
  }

  if (state.startsWith("pronunciation")) {
    return (
      <PronunciationReviewScreen
        actions={
          {
            answer: async () => ({ grade: { isCorrect: true, transcript: "utilities" }, status: "graded" }),
            finish: async () => ({
              brainPower: 6,
              ceremony: null,
              correct: 2,
              missionMoment: null,
              reached: { energy: null, level: null },
              total: 2,
            }),
          } as any
        }
        exitHref="/"
        reviews={{ goalId: "00000000-0000-7000-8000-000000000009", language: "en", words: WORDS } as any}
      />
    );
  }

  return null;
}

function Follower({ children }: FollowedRunProps) {
  const [startedAt] = useState(() => Date.now() - 9000);

  return children({
    failure: null,
    status: "following",
    stepTimes: { [CALL_STEP]: { started: startedAt } },
    steps: { [CALL_STEP]: "started" },
  });
}

function Voiced() {
  const loading = useSearchParams().get("state") === "pronunciation-loading";

  return (
    <SpeechPlayerProvider voice={loading ? never : noVoice}>
      <State />
    </SpeechPlayerProvider>
  );
}

export default function Page() {
  return (
    <PreviewIntlProvider>
      <LearnProvider adapters={ADAPTERS}>
        <GenerationFollowerProvider follower={Follower}>
          <Suspense>
            <Voiced />
          </Suspense>
        </GenerationFollowerProvider>
      </LearnProvider>
    </PreviewIntlProvider>
  );
}
