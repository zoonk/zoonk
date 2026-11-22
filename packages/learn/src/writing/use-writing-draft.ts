"use client";

import { MAX_ESSAY_CHARACTERS } from "@zoonk/core/exams/essays/contract";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { deviceStorage, subscribeToDeviceStorage } from "../_utils/device-storage";
import { createWritingClock } from "./writing-clock";
import {
  type DraftPosition,
  type Kept,
  type ServerDraft,
  acknowledgeSave,
  keepDraftText,
  keptDraftKey,
  openDraft,
  parseKeptDraft,
} from "./writing-draft-choice";
import { type WritingActions, type WrittenEssay } from "./writing-types";

const DRAFT_SAVE_MS = 1500;

/** The writing clock, paused while the page is out of view. */
function useWritingClock() {
  const clock = useMemo(() => createWritingClock(), []);

  useEffect(() => {
    const onVisibility = () =>
      document.visibilityState === "hidden" ? clock.hidden() : clock.visible();

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clock]);

  return {
    durationMs: clock.durationMs,
    reset: clock.reset,
    typed: () => clock.typed({ visible: document.visibilityState === "visible" }),
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

/** What the editor opens with: this device's copy when it belongs to the admission, else the saved draft. */
function useOpenedDraft(essay: WrittenEssay) {
  const raw = useSyncExternalStore(
    subscribeToDeviceStorage,
    () => deviceStorage.get(keptDraftKey(essay.blockId)),
    () => null,
  );

  const kept = parseKeptDraft(raw);
  const admissionId = essay.admissionId ?? null;

  return {
    ...openDraft({ admissionId, kept, saved: essay.draft ?? null }),
    raw: kept?.admissionId === admissionId ? raw : null,
  };
}

function useKeptDraft(blockId: string, openedRaw: () => string | null) {
  const key = keptDraftKey(blockId);
  const owned = useRef<string | null | undefined>(undefined);

  function claimOpened() {
    if (owned.current === undefined) {
      owned.current = openedRaw();
    }

    return owned.current;
  }

  function keep(draft: Kept) {
    owned.current = keepDraftText(blockId, draft);
  }

  function replace(next: Kept | null) {
    const expected = claimOpened();

    if (deviceStorage.get(key) !== expected) {
      return;
    }

    if (next) {
      keep(next);
    } else if (expected !== null && deviceStorage.remove(key)) {
      owned.current = null;
    }
  }

  return { claimOpened, keep, replace };
}

/**
 * The text stays on this device as it's typed and goes to the block's saved draft a moment later,
 * so "Continue" works on another device. A save that finds a newer draft stops and asks which one
 * to keep: nothing is overwritten on either side until the learner answers.
 */
export function useWritingDraft({
  actions,
  essay,
  showingGrade,
}: {
  actions: WritingActions;
  essay: WrittenEssay;
  showingGrade: boolean;
}) {
  const { blockId } = essay;
  const opened = useOpenedDraft(essay);

  // Null until the learner types or answers a conflict; before that, what the page opened with.
  const [local, setLocal] = useState<{ conflict: ServerDraft | null; text: string } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const text = local?.text ?? opened.text;
  const conflict = local ? local.conflict : opened.conflict;

  const live = useRef({ conflict, opened, text });
  const kept = useKeptDraft(blockId, () => live.current.opened.raw);
  const position = useRef<DraftPosition | null>(null);
  const sending = useRef<Promise<boolean>>(Promise.resolve(true));
  const gradedAdmission = useRef(showingGrade);
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
    kept.keep({ admissionId: at().admissionId, base, text: next });
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

    if (gradedAdmission.current || (!live.current.conflict && sent === at().text)) {
      return true;
    }

    if (live.current.conflict || sent.length > MAX_ESSAY_CHARACTERS) {
      return false;
    }

    kept.claimOpened();
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

    kept.replace(acknowledged.kept);

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
      kept.replace(null);
    }
  }

  function restart({ admissionId, from }: { admissionId: string; from: string }) {
    gradedAdmission.current = false;
    locked.current = false;
    position.current = { admissionId, revision: 0, text: "" };
    clock.reset();
    show({ conflict: null, text: from });
    keep(from);
    timer.current = setTimeout(() => void flush(), DRAFT_SAVE_MS);
  }

  return {
    admissionId: ensureAdmission,
    conflict,
    conflicted: () => Boolean(live.current.conflict),
    discard: () => kept.replace(null),
    durationMs: clock.durationMs,
    flush,
    /**
     * A grade came back for `gradedText`. When it's a replay of a send whose answer was lost, what's
     * typed here since stays on this device for the rewrite: the server stops offering its draft once
     * the admission is graded.
     */
    graded: (gradedText: string) => {
      gradedAdmission.current = true;

      kept.replace(
        gradedText === live.current.text
          ? null
          : { admissionId: at().admissionId, base: at().revision, text: live.current.text },
      );
    },
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
