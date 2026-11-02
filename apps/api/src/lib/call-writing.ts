import "server-only";
import { callContentWorkflow } from "@/workflows/calls/call-content-workflow";
import { type CallWriting } from "@zoonk/core/language/conversations/call-writing";
import { start } from "workflow/api";

export async function startCallWriting(writing: CallWriting): Promise<string> {
  const run = await start(callContentWorkflow, [writing]);
  return run.runId;
}
