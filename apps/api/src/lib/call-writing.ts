import "server-only";
import { startOnce } from "@/workflows/_shared/run-token";
import { callContentWorkflow } from "@/workflows/calls/call-content-workflow";
import {
  type CallWriting,
  getCallWritingKey,
} from "@zoonk/core/language/conversations/call-writing";

export function startCallWriting(writing: CallWriting): Promise<string> {
  return startOnce(callContentWorkflow, [writing], getCallWritingKey(writing));
}
