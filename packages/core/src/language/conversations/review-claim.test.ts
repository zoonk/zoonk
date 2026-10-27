import { randomUUID } from "node:crypto";
import { writeConversationFeedback } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { scoreSpeaking } from "@zoonk/ai/tasks/v2/language/speaking-score";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import {
  cleanupTestCalls,
  connectTestCall,
  reserveTestCall,
  setupTestCalls,
} from "../../_test-utils/connect-test-call";
import { mockSession } from "../../_test-utils/mock-session";
import { reviewRunsInline } from "../../_test-utils/review-runs";
import { liveCallFixture } from "./_test-utils/live-call-fixture";
import { claimConversationReview } from "./claim-conversation-review";
import { completeLanguageConversation } from "./complete-language-conversation";
import { startLanguageConversation } from "./start-language-conversation";

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  latencyMs: 1,
  model: "openai/gpt-6-luna",
  promptVersion: "v-test",
  provider: "openai",
  requestedModel: "openai/gpt-6-luna",
  runId: "run-test",
  usage: {},
};

const FEEDBACK = {
  encouragement: "Muito bem!",
  improve: { better: "Is it still available?", said: "It is available?", why: "Ordem." },
  pronunciation: [],
  wentWell: ["Can I see it on Saturday?"],
};

const TURNS = [
  { speaker: "character" as const, text: "Hi! Are you calling about the apartment?" },
  { speaker: "learner" as const, text: "It is available?" },
];

function modelAnswer<T>(data: T) {
  return {
    data,
    provenance: PROVENANCE,
    systemPrompt: "",
    usage: undefined as never,
    userPrompt: "",
  };
}

/** A learner's practice call, connected once; `connectionId` is that connection. */
async function connectedCall() {
  const { renting, user } = await languageGoalFixture();
  mockSession(user.id);

  const started = await startLanguageConversation({
    chapterId: renting.id,
    kind: "practice",
    minutes: 2,
  });

  if (started.status !== "ready") {
    throw new Error(`Couldn't start: ${started.status}`);
  }

  const { setup } = await connectTestCall(started.conversationId);
  return { connectionId: setup.connectionId, conversationId: started.conversationId, user };
}

function complete({
  connectionId,
  conversationId,
}: {
  connectionId: string;
  conversationId: string;
}) {
  return completeLanguageConversation({
    conversationId,
    input: { connectionId, spokenSeconds: 20, timeZone: "UTC", turns: TURNS, usedHelp: false },
    runs: reviewRunsInline,
  });
}

function claim(input: { connectionId: string; conversationId: string; userId: string }) {
  return (runId: string, replaces?: string) =>
    claimConversationReview({ ...input, replaces, runId });
}

/**
 * The call's ledger row can't be written the first `failures` times: settling fails after its
 * review, as a transaction past its time limit would.
 */
async function failSettling({ failures, userId }: { failures: number; userId: string }) {
  const suffix = randomUUID().replaceAll("-", "");
  const sequence = `settle_fault_seq_${suffix}`;
  const fault = `settle_fault_fn_${suffix}`;
  const trigger = `settle_fault_trigger_${suffix}`;

  onTestFinished(async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger} ON learning_events`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fault}()`);
    await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS ${sequence}`);
  });

  /** Names hold only a fixed prefix and UUID hex; DDL can't bind identifiers as values. */
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE ${sequence}`);

  await prisma.$executeRawUnsafe(`CREATE FUNCTION ${fault}() RETURNS trigger LANGUAGE plpgsql AS $fault$
    BEGIN
      IF NEW.user_id = '${userId}'::uuid AND nextval('${sequence}') <= ${failures} THEN
        RAISE EXCEPTION 'Test-owned settlement failure';
      END IF;
      RETURN NEW;
    END
  $fault$`);

  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER ${trigger} BEFORE INSERT ON learning_events FOR EACH ROW EXECUTE FUNCTION ${fault}()`,
  );
}

describe("a completed call's review", () => {
  beforeEach(async () => {
    await setupTestCalls();

    vi.mocked(checkConversationObjectives)
      .mockClear()
      .mockResolvedValue(
        modelAnswer({ met: [{ label: "Is it available?", learnerWords: "It is available?" }] }),
      );

    vi.mocked(writeConversationFeedback).mockClear().mockResolvedValue(modelAnswer(FEEDBACK));
  });

  afterEach(cleanupTestCalls);

  it("[F5] refuses a completion whose call another tab connected again before the claim, and leaves that call live", async () => {
    const first = await connectedCall();
    const second = await reserveTestCall(first.conversationId);

    if (second.status !== "ready") {
      throw new Error("Expected the reconnect");
    }

    await expect(
      claim({ ...first, userId: first.user.id })(`wrun_${randomUUID()}`),
    ).resolves.toStrictEqual({ status: "conversationEnded" });

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: first.conversationId } }),
    ).resolves.toMatchObject({ reviewRunId: null, status: "ready" });

    await expect(
      prisma.liveCallConnection.findUniqueOrThrow({ where: { id: second.setup.connectionId } }),
    ).resolves.toMatchObject({ state: "reserved" });
  });

  it("[F5] refuses a completion of a call another call took over", async () => {
    const call = await connectedCall();

    await prisma.liveCallConnection.update({
      data: { endReason: "takeover", state: "ended" },
      where: { id: call.connectionId },
    });

    await expect(
      claim({ ...call, userId: call.user.id })(`wrun_${randomUUID()}`),
    ).resolves.toStrictEqual({ status: "takenOver" });
  });

  it("[F4] keeps the claim for the run that made it on replay, and has any other run join it", async () => {
    const call = await connectedCall();
    const claimFor = claim({ ...call, userId: call.user.id });
    const runId = `wrun_${randomUUID()}`;

    await expect(claimFor(runId)).resolves.toStrictEqual({ status: "owner" });
    await expect(claimFor(runId)).resolves.toStrictEqual({ status: "owner" });

    await expect(claimFor(`wrun_${randomUUID()}`)).resolves.toStrictEqual({
      runId,
      status: "joined",
    });
  });

  it("[F4] lets exactly one of two retries replace a failed run's claim", async () => {
    const call = await connectedCall();
    const claimFor = claim({ ...call, userId: call.user.id });
    const failed = `wrun_${randomUUID()}`;
    await claimFor(failed);

    const [one, two] = [`wrun_${randomUUID()}`, `wrun_${randomUUID()}`];
    const claims = await Promise.all([claimFor(one, failed), claimFor(two, failed)]);

    expect(claims.filter((outcome) => outcome.status === "owner")).toHaveLength(1);
    expect(claims.filter((outcome) => outcome.status === "joined")).toHaveLength(1);
  });

  it("[3] completes the call without feedback, with the goals marked during it, when the review keeps failing", async () => {
    const call = await connectedCall();

    await prisma.languageConversation.update({
      data: { objectivesMet: ["Is it available?"] },
      where: { id: call.conversationId },
    });

    vi.mocked(writeConversationFeedback).mockRejectedValue(new Error("The model is down"));

    await expect(complete(call)).resolves.toMatchObject({
      conversation: { result: { feedback: null }, status: "completed" },
      status: "completed",
    });

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.conversationId } }),
    ).resolves.toMatchObject({ feedback: null, objectivesMet: ["Is it available?"] });
  });

  it("[3] completes an exam task the candidate spoke in with its goal when its scoring keeps failing", async () => {
    const { conversation, user } = await liveCallFixture({ kind: "examSpeaking", plus: true });
    mockSession(user.id);
    const { setup } = await connectTestCall(conversation.id);
    vi.mocked(scoreSpeaking).mockRejectedValue(new Error("The model is down"));

    await expect(
      complete({ connectionId: setup.connectionId, conversationId: conversation.id }),
    ).resolves.toMatchObject({ status: "completed" });

    const saved = await prisma.languageConversation.findUniqueOrThrow({
      where: { id: conversation.id },
    });

    expect(saved).toMatchObject({ feedback: null, status: "completed" });
    expect(saved.objectivesMet).toStrictEqual(
      RENTING_SCENARIO.objectives.map((objective) => objective.label),
    );
  });

  it("[3] keeps a finished review when settling fails, and completes on retry without grading again", async () => {
    const call = await connectedCall();
    await failSettling({ failures: 1, userId: call.user.id });

    await expect(complete(call)).resolves.toStrictEqual({ status: "retryable" });

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.conversationId } }),
    ).resolves.toMatchObject({ feedback: FEEDBACK, status: "ready" });

    await expect(complete(call)).resolves.toMatchObject({
      conversation: { result: { feedback: FEEDBACK }, status: "completed" },
      status: "completed",
    });

    expect(writeConversationFeedback).toHaveBeenCalledOnce();
    expect(checkConversationObjectives).toHaveBeenCalledOnce();
  });
});
