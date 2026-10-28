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
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import { DoneMark } from "../_components/status-mark";
import { TaskActions } from "../_components/task-layout";
import { useTaskMinutes } from "../language/exam-speaking/speaking-task-row";
import { LearnLink } from "../learn-link";
import { QUESTION_TEXT_CLASS } from "../questions/item-text";
import { TaskMainButton } from "../shell/task-frame";
import { ClockTitle } from "./mock-clock";
import { useMockScreen } from "./mock-context";
import { MockFrame, MockStepStatus } from "./mock-frame";

type SpeakingTask = SpeakingSectionView["tasks"][number];

function SpeakingTaskRow({ number, task }: { number: number; task: SpeakingTask }) {
  const t = useExtracted();
  const { hrefs } = useMockScreen();
  const minutes = useTaskMinutes();
  const done = task.status === "completed";

  return (
    <li className="flex items-center gap-3 py-2.75">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          {t("Task {number, number} · {time}", { number, time: minutes(task.minutes) })}
        </p>
        <p className="text-sm leading-snug font-medium text-pretty">{task.name}</p>
      </div>

      {done ? (
        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm">
          <DoneMark />
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

      <ol className={LIST_GROUP_CLASS}>
        {paper.tasks.map((task, index) => (
          <SpeakingTaskRow key={task.key} number={index + 1} task={task} />
        ))}
      </ol>
    </div>
  );
}

function SpeakingHandIn({ isLast, left }: { isLast: boolean; left: number }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const [confirming, setConfirming] = useState(false);
  const label = isLast ? t("Hand in the mock exam") : t("Hand in this section");

  return (
    <>
      <MockStepStatus />
      <TaskActions>
        <TaskMainButton
          busy={runner.busy === "submit"}
          disabled={runner.pending}
          onClick={() => setConfirming(true)}
        >
          {label}
        </TaskMainButton>
      </TaskActions>

      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isLast ? t("Hand in the mock exam?") : t("Hand in this section?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {left > 0
                ? t(
                    "{count, plural, one {# task isn't done,} other {# tasks aren't done,}} so this paper gets no estimate. After this, you can't do them in this mock.",
                    { count: left },
                  )
                : t("Every task is done. After this, you can't do them again in this mock.")}
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

function SpeakingScreen({ deadline, section: index }: { deadline: string; section: number }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { sections, speaking } = runner.view;
  const section = sections[index];
  const isLast = index === sections.length - 1;
  const starting = runner.busy === "startSpeaking";

  const footer = speaking ? (
    <SpeakingHandIn
      isLast={isLast}
      left={speaking.tasks.filter((task) => task.status !== "completed").length}
    />
  ) : (
    <>
      <MockStepStatus />
      <TaskActions>
        <TaskMainButton
          busy={starting}
          disabled={runner.pending}
          onClick={() => void runner.startSpeaking()}
        >
          {starting ? t("Writing your task cards…") : t("Start the speaking part")}
        </TaskMainButton>
      </TaskActions>
    </>
  );

  return (
    <MockFrame footer={footer} headerTitle={<ClockTitle deadline={deadline} />}>
      <div className="flex flex-col gap-4">
        <h2 className={QUESTION_TEXT_CLASS}>{section?.name ?? speaking?.paper ?? t("Speaking")}</h2>

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

/**
 * Its cards are written when the learner starts the section, so a mock handed in before it never
 * pays for them.
 */
export function MockSpeakingView() {
  const { runner } = useMockScreen();
  const { current } = runner.view;

  return current ? <SpeakingScreen deadline={current.deadline} section={current.section} /> : null;
}
