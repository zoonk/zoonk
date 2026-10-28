"use client";

import { type SpeakingPaperView } from "@zoonk/core/language/exam-speaking/contract";
import { PhoneOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { ListGroup } from "../../_components/list-group";
import {
  NoticeCard,
  NoticeCardContent,
  NoticeCardDescription,
  NoticeCardTitle,
} from "../../_components/notice-card";
import {
  PageSection,
  PageSectionDetail,
  PageSectionFooter,
  PageSectionHeader,
  PageSectionTitle,
} from "../../_components/page";
import { PlusNotice } from "../../_components/plus-lock";
import { GenerationWait } from "../../generation/generation-wait";
import { CallLimitMessage } from "../conversation/call-limit-message";
import { useCallStart } from "../conversation/use-call-start";
import { TaskRow, getTaskRowId } from "./speaking-task-row";

export type ExamTaskStart = boolean | { limit: CallLimit };

function useOpenTask(openTask: string | null) {
  useEffect(() => {
    if (!openTask) {
      return;
    }

    const row = document.querySelector<HTMLElement>(`#${CSS.escape(getTaskRowId(openTask))}`);
    row?.scrollIntoView({ block: "center" });
    row?.focus({ preventScroll: true });
  }, [openTask]);
}

export function SpeakingPaperSection({
  onStart,
  openTask = null,
  paper,
  resultHref,
  title,
}: {
  onStart: (task: string) => Promise<ExamTaskStart>;
  openTask?: string | null;
  paper: SpeakingPaperView;
  resultHref: (conversationId: string) => string;
  title?: string;
}) {
  const t = useExtracted();
  const titleId = useId();
  const selected = useRef<string | null>(null);
  const [startedTask, setStartedTask] = useState<string | null>(null);
  const [limit, setLimit] = useState<CallLimit | null>(null);
  const locked = paper.access === "plusRequired";
  const paused = paper.access === "callsPaused";

  const call = useCallStart({
    onStart: async () => {
      const started = selected.current ? await onStart(selected.current) : false;

      if (typeof started === "boolean") {
        return started;
      }

      setLimit(started.limit);
      return false;
    },
    step: "writeTask",
  });

  const busy = call.isStarting || call.run !== null;
  useOpenTask(openTask);

  return (
    <PageSection aria-labelledby={titleId} data-slot="speaking-paper">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{title ?? t("Speaking")}</PageSectionTitle>
        {!title && <PageSectionDetail>{paper.title}</PageSectionDetail>}
      </PageSectionHeader>

      {locked && (
        <PlusNotice>
          {t(
            "Speaking practice comes with Plus: every task of the paper on a call, and an estimate on the official criteria after each one.",
          )}
        </PlusNotice>
      )}

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

      <ListGroup>
        {/* The router keeps the page, so the key remounts the list for a link asking for another task. */}
        <ol key={openTask}>
          {paper.tasks.map((task, index) => (
            <li key={task.key}>
              <TaskRow
                busy={busy}
                defaultOpen={openTask === task.key}
                index={index}
                language={paper.language}
                level={paper.level}
                locked={locked || paused}
                onStart={() => {
                  selected.current = task.key;
                  setStartedTask(task.key);
                  setLimit(null);
                  call.start();
                }}
                paused={paused}
                resultHref={resultHref}
                starting={call.isStarting && startedTask === task.key}
                task={task}
              />
            </li>
          ))}
        </ol>
      </ListGroup>

      {call.run && (
        <GenerationWait kind="examSpeaking" run={call.run}>
          {call.run.status !== "failed" && (
            <p className="text-muted-foreground text-sm">
              {t("Your task opens as soon as its card is ready.")}
            </p>
          )}
        </GenerationWait>
      )}

      {call.failed && limit && (
        <CallLimitMessage
          className="py-4"
          limit={limit}
          title={
            limit.period === "month"
              ? t("Not enough call time this month for this task")
              : t("Not enough call time today for this task")
          }
        />
      )}

      {call.failed && !limit && (
        <p className="text-destructive-text px-1 text-sm" role="alert">
          {t("The task didn't start. Try again in a moment.")}
        </p>
      )}

      <PageSectionFooter>
        {paper.tasks.some((task) => task.role === "partner")
          ? t(
              "An AI stands in for the human examiner or the other candidate. Each try has a new card, and after it you get an estimate on the exam's official criteria, not an official score.",
            )
          : t(
              "An AI stands in for the human examiner. Each try has a new card, and after it you get an estimate on the exam's official criteria, not an official score.",
            )}{" "}
        <a href={paper.source} rel="noreferrer" target="_blank">
          {t("Official format")}
        </a>
      </PageSectionFooter>
    </PageSection>
  );
}
