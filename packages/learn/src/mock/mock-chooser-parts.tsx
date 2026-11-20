"use client";

import { type MockOptionsView, type MockShape } from "@zoonk/core/exams/mocks/contract";

/**
 * `preparing` is the start's answer, for the page as it was read when Start was pressed (`over`): a
 * newer read says itself whether the requested mock is ready.
 */
export type MockChooserStatus =
  | { kind: "choosing" }
  | { kind: "failed" }
  | { kind: "preparing"; optionKey: string; over: MockOptionsView };

export function getMockOptionKey(option: MockShape): string {
  return [option.kind, option.day ?? "", option.area ?? ""].join(":");
}

/** The option whose questions are still being written, if any. */
export function getPreparingKey({
  status,
  view,
}: {
  status: MockChooserStatus;
  view: MockOptionsView;
}): string | null {
  if (status.kind === "preparing" && status.over === view) {
    return status.optionKey;
  }

  const { requested } = view;
  return requested?.status === "preparing" ? getMockOptionKey(requested.shape) : null;
}
