import { describe, expect, it } from "vitest";
import { getChallengeStatus } from "./challenge-status";

const DUE = { due: true, itemStatus: "todo", plusRequired: false, todayBlockStatus: null } as const;

describe(getChallengeStatus, () => {
  it("is upcoming before its day, and done once its plan item is", () => {
    expect(getChallengeStatus({ ...DUE, due: false })).toBe("upcoming");

    expect(getChallengeStatus({ ...DUE, itemStatus: "done", todayBlockStatus: "completed" })).toBe(
      "done",
    );
  });

  it("follows today's block: ready, started, then tried when it didn't pass", () => {
    expect(getChallengeStatus({ ...DUE, todayBlockStatus: "pending" })).toBe("ready");
    expect(getChallengeStatus({ ...DUE, todayBlockStatus: "active" })).toBe("started");
    expect(getChallengeStatus({ ...DUE, todayBlockStatus: "completed" })).toBe("tried");
  });

  it("waits for the next session when today's was planned without it", () => {
    expect(getChallengeStatus(DUE)).toBe("waiting");
    expect(getChallengeStatus({ ...DUE, todayBlockStatus: "skipped" })).toBe("waiting");
  });

  it("says Plus is needed for a mock the plan doesn't include, before its day too", () => {
    expect(getChallengeStatus({ ...DUE, plusRequired: true })).toBe("plusRequired");
    expect(getChallengeStatus({ ...DUE, due: false, plusRequired: true })).toBe("plusRequired");
  });
});
