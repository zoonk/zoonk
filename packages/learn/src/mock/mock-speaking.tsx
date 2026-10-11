"use client";

import { type SpeakingSectionView } from "@zoonk/core/language/exam-speaking/contract";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@zoonk/ui/components/alert-dialog";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, MicIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useTaskMinutes } from "../language/exam-speaking/speaking-task-row";
import { LearnLink } from "../learn-link";
import { TaskMainButton } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";
import { ClockTitle } from "./mock-runner-view";

type SpeakingTask = SpeakingSectionView["tasks"][number];

/** One task of the paper: its name and time, and its call to open, or done. */
function SpeakingTaskRow({ number, task }: { number: number; task: SpeakingTask }) {
  const t = useExtracted();
  const { hrefs } = useMockScreen();
  const minutes = useTaskMinutes();
  const done = task.status === "completed";

  return (
    <li className="flex items-center gap-3 rounded-2xl border p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-muted-foreground text-xs">
          {t("Task {number, number} · {time}", { number, time: minutes(task.minutes) })}
        </p>
        <p className="font-medium text-pretty">{task.name}</p>
      </div>

      {done ? (
        <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm">
          <CheckIcon aria-hidden="true" className="size-4" />
          {t("Done")}
        </span>
      ) : (
        <LearnLink
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "shrink-0")}
          href={hrefs.speakingTask(task.conversationId)}
        >
          {t("Start")}
        </LearnLink>
      )}
    </li>
  );
}

/** The paper's tasks in the exam's order, each a call with the examiner. */
function SpeakingPaper({ paper }: { paper: SpeakingSectionView }) {
  const t = useExtracted();
  const left = paper.tasks.filter((task) => task.status !== "completed").length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm text-pretty">
        {left > 0
          ? t(
              "Do the tasks in order. Each one is a call, and you come back here after it. {count, plural, one {# task left.} other {# tasks left.}}",
              { count: left },
            )
          : t("Every task is done. Hand in this section to go on.")}
      </p>

      <ol className="flex flex-col gap-2">
        {paper.tasks.map((task, index) => (
          <SpeakingTaskRow key={task.key} number={index + 1} task={task} />
        ))}
      </ol>
    </div>
  );
}

/**
 * Handing the speaking section in with tasks still to do can't be undone, so it's confirmed first:
 * the paper's estimate needs every task.
 */
function SpeakingHandIn({ isLast, left }: { isLast: boolean; left: number }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const [confirming, setConfirming] = useState(false);
  const label = isLast ? t("Hand in the mock exam") : t("Hand in this section");

  return (
    <>
      <MockStepStatus />
      <TaskMainButton
        busy={runner.busy === "submit"}
        disabled={runner.pending}
        onClick={() => (left > 0 ? setConfirming(true) : void runner.submitSection())}
      >
        {label}
      </TaskMainButton>

      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLast ? t("Hand in the mock exam?") : t("Hand in this section?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "{count, plural, one {# task isn't done,} other {# tasks aren't done,}} so this paper gets no estimate. After this, you can't do them in this mock.",
                { count: left },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep going")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                void runner.submitSection();
              }}
            >
              {t("Hand in")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The mock's speaking section: the exam's speaking paper, each task a live call with an examiner
 * the app stands in for. Its cards are written when the learner starts the section, so a mock
 * handed in before it never pays for them. The section's clock runs through the calls, as the
 * exam's does, and handing it in moves on; tasks not done count as not done.
 */
export function MockSpeakingView() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { current, sections, speaking } = runner.view;

  if (!current) {
    return null;
  }

  const section = sections[current.section];
  const isLast = current.section === sections.length - 1;
  const starting = runner.busy === "startSpeaking";

  const footer = speaking ? (
    <SpeakingHandIn
      isLast={isLast}
      left={speaking.tasks.filter((task) => task.status !== "completed").length}
    />
  ) : (
    <TaskMainButton
      busy={starting}
      disabled={runner.pending}
      onClick={() => void runner.startSpeaking()}
    >
      {starting ? t("Writing your task cards…") : t("Start the speaking part")}
    </TaskMainButton>
  );

  return (
    <MockFrame footer={footer} headerTitle={<ClockTitle deadline={current.deadline} />}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MicIcon aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
          <h2 className="text-lg font-semibold text-balance">
            {section?.name ?? speaking?.paper ?? t("Speaking")}
          </h2>
        </div>

        {speaking ? (
          <SpeakingPaper paper={speaking} />
        ) : (
          <p className="text-muted-foreground text-pretty">
            {t(
              "Each task is a live call with an examiner, as in the exam: an AI stands in for the person. Your task cards are written when you start, which takes about half a minute.",
            )}
          </p>
        )}
      </div>
    </MockFrame>
  );
}
