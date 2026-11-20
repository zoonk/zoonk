"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { deviceStorage, subscribeToDeviceStorage } from "../_utils/device-storage";
import {
  chooseDraftText,
  keepDraftText,
  keptDraftKey,
  parseKeptDraft,
} from "./writing-draft-choice";
import { type WritingActions, type WrittenEssay } from "./writing-types";

const DRAFT_SAVE_MS = 1500;

/**
 * The text stays on this device as it's typed and goes to the block's saved draft a moment later,
 * so "Continue" works on another device. A save that finds a newer draft keeps what was typed here
 * and saves it over that one.
 */
export function useWritingDraft({
  actions,
  essay,
}: {
  actions: WritingActions;
  essay: WrittenEssay;
}) {
  const { blockId } = essay;

  const raw = useSyncExternalStore(
    subscribeToDeviceStorage,
    () => deviceStorage.get(keptDraftKey(blockId)),
    () => null,
  );

  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? chooseDraftText({ kept: parseKeptDraft(raw), saved: essay.draft ?? null });
  const admission = useRef(essay.draft?.admissionId ?? null);
  const revision = useRef(essay.draft?.revision ?? 0);
  const saved = useRef(essay.draft?.text ?? "");
  const latest = useRef<string | null>(null);
  const saving = useRef<Promise<unknown> | null>(null);
  const typingSince = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  async function ensureAdmission(): Promise<string | null> {
    if (admission.current) {
      return admission.current;
    }

    const started = await actions.start({}).catch(() => null);

    if (started?.status !== "ready") {
      return null;
    }

    admission.current = started.admissionId;
    return admission.current;
  }

  async function save(current: string, retried = false): Promise<void> {
    const admissionId = await ensureAdmission();

    if (!admissionId || current === saved.current) {
      return;
    }

    const answer = await actions
      .saveDraft({ admissionId, revision: revision.current, text: current })
      .catch(() => ({ status: "failed" as const }));

    if (answer.status === "saved") {
      revision.current = answer.draft.revision;
      saved.current = current;
      keepDraftText(blockId, { base: answer.draft.revision, text: current });
    }

    // Another device saved first: what was typed here goes over it, once.
    if (answer.status === "conflict" && !retried) {
      revision.current = answer.draft.revision;
      await save(current, true);
    }
  }

  function flush(): Promise<unknown> {
    clearTimeout(timer.current ?? undefined);
    const current = latest.current ?? text;
    saving.current = (saving.current ?? Promise.resolve()).then(() => save(current));
    return saving.current;
  }

  function write(next: string) {
    typingSince.current ??= Date.now();
    latest.current = next;
    setTyped(next);
    keepDraftText(blockId, { base: revision.current, text: next });
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => void flush(), DRAFT_SAVE_MS);
  }

  function restart({ admissionId, from }: { admissionId: string; from: string }) {
    admission.current = admissionId;
    revision.current = 0;
    saved.current = "";
    typingSince.current = null;
    write(from);
  }

  function durationMs(): number {
    return typingSince.current === null ? 0 : Date.now() - typingSince.current;
  }

  return {
    admissionId: ensureAdmission,
    clear: () => deviceStorage.remove(keptDraftKey(blockId)),
    durationMs,
    flush,
    pending: () => saving.current,
    restart,
    text,
    write,
  };
}

export type WritingDraftState = ReturnType<typeof useWritingDraft>;
