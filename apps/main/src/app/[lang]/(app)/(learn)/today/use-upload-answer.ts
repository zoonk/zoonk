"use client";

import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { type AttachedSource } from "@zoonk/learn/onboarding/actions";
import { useTodayVisit } from "@zoonk/learn/today/visit";
import { type UploadRequestView } from "@zoonk/learn/upload-request";
import { useState } from "react";

/** `unreadable`: nothing on the answered upload could be read, so the request asks again. */
type UploadAnswer = {
  state:
    | { kind: "answered" | "unreadable"; request: GoalUploadRequest; source: AttachedSource }
    | { kind: "dismissed" };
  visit: number;
};

type HostUpload = {
  answered: AttachedSource | null;
  request: (GoalUploadRequest & UploadRequestView) | null;
};

export function useUploadAnswer() {
  const visit = useTodayVisit();
  const [upload, setUpload] = useState<UploadAnswer | null>(null);
  const state = upload?.visit === visit ? upload.state : null;

  return {
    onUploadAnswered: (request: GoalUploadRequest, source: AttachedSource) =>
      setUpload({ state: { kind: "answered", request, source }, visit }),
    onUploadDismissed: () => setUpload({ state: { kind: "dismissed" }, visit }),
    onUploadUnreadable: (request: GoalUploadRequest, source: AttachedSource) =>
      setUpload({ state: { kind: "unreadable", request, source }, visit }),
    uploadState: state,
  };
}

export function toHostUpload({
  state,
  today,
}: {
  state: UploadAnswer["state"] | null;
  today: GoalUploadRequest | null;
}): HostUpload {
  if (state?.kind === "dismissed") {
    return { answered: null, request: null };
  }

  if (state?.kind === "answered") {
    return { answered: state.source, request: state.request };
  }

  if (state?.kind === "unreadable") {
    return {
      answered: null,
      request: { ...state.request, unreadableUpload: { title: state.source.title } },
    };
  }

  return { answered: null, request: today };
}
