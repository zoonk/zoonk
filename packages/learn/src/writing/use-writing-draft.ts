"use client";

import { MAX_ESSAY_CHARACTERS, MAX_WRITING_MS } from "@zoonk/core/exams/essays/contract";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { deviceStorage, subscribeToDeviceStorage } from "../_utils/device-storage";
import {
  type DraftPosition,
  type ServerDraft,
  acknowledgeSave,
  keepDraftText,
  keptDraftKey,
  openDraft,
  parseKeptDraft,
} from "./writing-draft-choice";
import { type WritingActions, type WrittenEssay } from "./writing-types";

const DRAFT_SAVE_MS = 1500;

/** Time on the field while the page is in view, on a clock a device's time change can't move. */
function useWritingClock() {
  const total = useRef(0);
  const since = useRef<number | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && since.current !== null) {
        total.current += performance.now() - since.current;
        since.current = null;
      } else if (document.visibilityState === "visible" && started.current) {
        since.current ??= performance.now();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return {
    durationMs: () => {
      const running = since.current === null ? 0 : performance.now() - since.current;
      return Math.round(Math.min(MAX_WRITING_MS, Math.max(0, total.current + running)));
    },
    reset: () => {
      total.current = 0;
      since.current = null;
      started.current = false;
    },
    typed: () => {
      started.current = true;

      if (document.visibilityState === "visible") {
        since.current ??= performance.now();
      }
    },
  };
}

/**
 * Leaving by any route saves the latest edit: the tab hidden or closed, with a request that
 * outlives the page; the connection back; or the screen closed inside the app.
 */
function useSaveOnLeave(flush: (options?: { keepalive?: boolean }) => Promise<boolean>) {
  const latest = useRef(flush);

  useEffect(() => {
    latest.current = flush;
  });

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        void latest.current({ keepalive: true });
      }
    };

    const onPageHide = () => void latest.current({ keepalive: true });
    const onOnline = () => void latest.current();

    document.addEventListener("visibilitychange", onHidden);
    globalThis.addEventListener("pagehide", onPageHide);
    globalThis.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      globalThis.removeEventListener("pagehide", onPageHide);
      globalThis.removeEventListener("online", onOnline);
      void latest.current();
    };
  }, []);
}

/**
 * The text stays on this device as it's typed and goes to the block's saved draft a moment later,
 * so "Continue" works on another device. A save that finds a newer draft stops and asks which one
 * to keep: nothing is overwritten on either side until the learner answers.
 */
export function useWritingDraft({
  actions,
  essay,
}: {
  actions: WritingActions;
  essay: WrittenEssay;
}) {
  const { blockId } = essay;
  const key = keptDraftKey(blockId);

  const raw = useSyncExternalStore(
    subscribeToDeviceStorage,
    () => deviceStorage.get(key),
    () => null,
  );

  const opened = openDraft({
    admissionId: essay.admissionId ?? null,
    kept: parseKeptDraft(raw),
    saved: essay.draft ?? null,
  });

  // Null until the learner types or answers a conflict; before that, what the page opened with.
  const [local, setLocal] = useState<{ conflict: ServerDraft | null; text: string } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const text = local?.text ?? opened.text;
  const conflict = local ? local.conflict : opened.conflict;

  const live = useRef({ conflict, opened, text });
  const position = useRef<DraftPosition | null>(null);
  const sending = useRef<Promise<boolean>>(Promise.resolve(true));
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clock = useWritingClock();

  useEffect(() => {
    live.current = { conflict, opened, text };
  });

  function at(): DraftPosition {
    position.current ??= live.current.opened.position;
    return position.current;
  }

  function keep(next: string, base = at().revision) {
    keepDraftText(blockId, { admissionId: at().admissionId, base, text: next });
  }

  function show(next: { conflict: ServerDraft | null; text: string }) {
    live.current = { ...live.current, ...next };
    setLocal(next);
  }

  async function ensureAdmission(): Promise<string | null> {
    const current = at();

    if (current.admissionId) {
      return current.admissionId;
    }

    const started = await actions.start({}).catch(() => null);

    if (started?.status !== "ready") {
      return null;
    }

    position.current = { ...current, admissionId: started.admissionId };
    return started.admissionId;
  }

  /** True when what the editor holds is on the server. */
  async function save(keepalive: boolean): Promise<boolean> {
    const sent = live.current.text;

    if (live.current.conflict) {
      return false;
    }

    if (sent === at().text) {
      return true;
    }

    if (sent.length > MAX_ESSAY_CHARACTERS) {
      return false;
    }

    const admissionId = await ensureAdmission();

    const answer = admissionId
      ? await actions
          .saveDraft({ admissionId, revision: at().revision, text: sent }, { keepalive })
          .catch(() => ({ status: "failed" as const }))
      : ({ status: "failed" } as const);

    if (answer.status === "conflict") {
      show({ conflict: answer.draft, text: live.current.text });
      return false;
    }

    if (answer.status !== "saved" || !admissionId) {
      setSaveFailed(true);
      return false;
    }

    const acknowledged = acknowledgeSave({
      admissionId,
      latest: live.current.text,
      revision: answer.draft.revision,
      sent,
    });

    position.current = acknowledged.position;

    if (acknowledged.kept) {
      keepDraftText(blockId, acknowledged.kept);
    } else {
      deviceStorage.remove(key);
    }

    setSaveFailed(false);
    return !acknowledged.kept;
  }

  /** Saves the latest edit after any save already out, and says whether it's on the server. */
  function flush({ keepalive = false }: { keepalive?: boolean } = {}): Promise<boolean> {
    clearTimeout(timer.current ?? undefined);
    sending.current = sending.current.then(() => save(keepalive));
    return sending.current;
  }

  useSaveOnLeave(flush);

  function write(next: string) {
    if (locked.current) {
      return;
    }

    clock.typed();
    show({ conflict: live.current.conflict, text: next });
    keep(next);
    setSaveFailed(false);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => void flush(), DRAFT_SAVE_MS);
  }

  /** "Keep this one" saves what's typed here over the other device's draft; "Use the other" takes it. */
  function answerConflict(keepHere: boolean) {
    const other = live.current.conflict;

    if (!other) {
      return;
    }

    position.current = { ...at(), revision: other.revision, text: other.text };
    show({ conflict: null, text: keepHere ? live.current.text : other.text });

    if (keepHere) {
      keep(live.current.text);
      void flush();
    } else {
      deviceStorage.remove(key);
    }
  }

  function restart({ admissionId, from }: { admissionId: string; from: string }) {
    locked.current = false;
    position.current = { admissionId, revision: 0, text: "" };
    clock.reset();
    show({ conflict: null, text: from });
    keep(from);
    timer.current = setTimeout(() => void flush(), DRAFT_SAVE_MS);
  }

  return {
    admissionId: ensureAdmission,
    clear: () => deviceStorage.remove(key),
    conflict,
    conflicted: () => Boolean(live.current.conflict),
    durationMs: clock.durationMs,
    flush,
    keepMine: () => answerConflict(true),
    /** While an answer is out for grading, the field takes no edits. */
    lock: (value: boolean) => {
      locked.current = value;
    },
    restart,
    saveFailed,
    takeOther: () => answerConflict(false),
    text,
    write,
  };
}

export type WritingDraftState = ReturnType<typeof useWritingDraft>;
