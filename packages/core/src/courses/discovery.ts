import "server-only";
import {
  type CourseDiscoveryQuestion,
  generateCourseDiscovery,
} from "@zoonk/ai/tasks/courses/discovery";
import { type CourseDiscovery, databaseNull, prisma } from "@zoonk/db";
import { getSession } from "../users/get-session";
import { learningRequestIdentity } from "./_utils/learning-request-identity";
import { claimLearningRequestQuota } from "./_utils/learning-request-quota";
import { startCourseDiscovery } from "./_utils/start-course-discovery";
import {
  type DiscoveryAnswerInput,
  type DiscoveryRevisionInput,
  discoveryAnswerInputSchema,
  discoveryAnswersSchema,
  discoveryBriefSchema,
  discoveryQuestionSchema,
  discoveryResolutionSchema,
  discoveryRevisionInputSchema,
  learningRequestInputSchema,
} from "./discovery-contract";

const DISCOVERY_LEASE_MS = 180_000;

function toDiscoveryResource(discovery: CourseDiscovery) {
  const resolution = discoveryResolutionSchema.safeParse(discovery.resolution);
  const coursePromptId = resolution.success ? resolution.data.coursePromptId : undefined;

  const generationTarget = coursePromptId
    ? { resource: "coursePrompt" as const, resourceId: coursePromptId }
    : null;

  return {
    answers: discoveryAnswersSchema.parse(discovery.answers),
    brief: discoveryBriefSchema.nullable().parse(discovery.brief),
    courseId: discovery.courseId,
    generationTarget:
      generationTarget ??
      (discovery.courseId && discovery.status === "generating"
        ? { resource: "curriculum" as const, resourceId: discovery.courseId }
        : null),
    id: discovery.id,
    language: discovery.language,
    prompt: discovery.prompt,
    question: discoveryQuestionSchema.nullable().parse(discovery.nextQuestion),
    revision: discovery.revision,
    status:
      discovery.status === "pending" &&
      Date.now() - discovery.updatedAt.getTime() >= DISCOVERY_LEASE_MS
        ? ("failed" as const)
        : discovery.status,
  };
}

async function runDiscovery(discovery: CourseDiscovery) {
  try {
    const quota = await claimLearningRequestQuota();

    if (quota.status !== "ready") {
      await prisma.courseDiscovery.updateMany({
        data: { status: "failed" },
        where: { id: discovery.id, revision: discovery.revision, status: "pending" },
      });

      return quota;
    }

    const profile = await prisma.userLearningProfile.findUnique({
      where: { userId: discovery.userId },
    });

    const interests = Array.isArray(profile?.interests)
      ? profile.interests.filter((item): item is string => typeof item === "string")
      : [];

    const result = await generateCourseDiscovery({
      answers: discoveryAnswersSchema.parse(discovery.answers),
      interests,
      language: discovery.language,
      prompt: discovery.prompt,
    });

    await prisma.courseDiscovery.updateMany({
      data: {
        brief: result.data.brief ?? databaseNull,
        nextQuestion: result.data.question ?? databaseNull,
        resolution: result.data,
        status: result.data.status,
      },
      where: { id: discovery.id, revision: discovery.revision, status: "pending" },
    });

    return {
      discovery: toDiscoveryResource(
        await prisma.courseDiscovery.findUniqueOrThrow({ where: { id: discovery.id } }),
      ),
      status: "ready" as const,
    };
  } catch (error) {
    await prisma.courseDiscovery.updateMany({
      data: { status: "failed" },
      where: { id: discovery.id, revision: discovery.revision, status: "pending" },
    });

    throw error;
  }
}

export async function createCurrentUserCourseDiscovery(input: {
  language: string;
  prompt: string;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const parsed = learningRequestInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" as const };
  }

  const id = learningRequestIdentity({
    ...parsed.data,
    kind: "discovery",
    userId: session.user.id,
  });

  const inserted = await prisma.courseDiscovery.createMany({
    data: { ...parsed.data, id, userId: session.user.id },
    skipDuplicates: true,
  });

  const discovery = await prisma.courseDiscovery.findUniqueOrThrow({ where: { id } });

  if (inserted.count === 0) {
    return { discovery: toDiscoveryResource(discovery), status: "ready" as const };
  }

  return runDiscovery(discovery);
}

export async function getCurrentUserCourseDiscovery({ discoveryId }: { discoveryId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const discovery = await prisma.courseDiscovery.findFirst({
    where: { id: discoveryId, userId: session.user.id },
  });

  return discovery
    ? { discovery: toDiscoveryResource(discovery), status: "ready" as const }
    : { status: "notFound" as const };
}

function answerText(question: CourseDiscoveryQuestion, input: DiscoveryAnswerInput): string | null {
  const selections =
    Number(Boolean(input.optionId)) +
    Number(Boolean(input.otherAnswer)) +
    Number(input.skip === true);

  if (selections !== 1) {
    return null;
  }

  if (input.skip) {
    return question.optional ? "No preference" : null;
  }

  if (input.otherAnswer) {
    return input.otherAnswer;
  }

  return question.options.find((option) => option.id === input.optionId)?.label ?? null;
}

export async function answerCurrentUserCourseDiscovery({
  discoveryId,
  ...input
}: DiscoveryAnswerInput & { discoveryId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const parsed = discoveryAnswerInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" as const };
  }

  const discovery = await prisma.courseDiscovery.findFirst({
    where: { id: discoveryId, userId: session.user.id },
  });

  if (!discovery) {
    return { status: "notFound" as const };
  }

  if (discovery.revision !== input.expectedRevision || discovery.status !== "ask") {
    return { status: "conflict" as const };
  }

  const question = discoveryQuestionSchema.nullable().parse(discovery.nextQuestion);

  if (!question || question.id !== input.questionId) {
    return { status: "invalid" as const };
  }

  const answer = answerText(question, parsed.data);

  if (!answer) {
    return { status: "invalid" as const };
  }

  const answers = [
    ...discoveryAnswersSchema.parse(discovery.answers),
    { answer, question: question.question, questionId: question.id },
  ];

  const claim = await prisma.courseDiscovery.updateMany({
    data: { answers, revision: { increment: 1 }, status: "pending" },
    where: {
      id: discoveryId,
      revision: input.expectedRevision,
      status: "ask",
      userId: session.user.id,
    },
  });

  if (claim.count === 0) {
    return { status: "conflict" as const };
  }

  return runDiscovery({
    ...discovery,
    answers,
    revision: discovery.revision + 1,
    status: "pending",
  });
}

export async function retryCurrentUserCourseDiscovery({ discoveryId }: { discoveryId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const claim = await prisma.courseDiscovery.updateMany({
    data: { revision: { increment: 1 }, status: "pending" },
    where: {
      OR: [
        { status: "failed" },
        { status: "pending", updatedAt: { lte: new Date(Date.now() - DISCOVERY_LEASE_MS) } },
      ],
      id: discoveryId,
      userId: session.user.id,
    },
  });

  if (claim.count === 0) {
    return { status: "conflict" as const };
  }

  return runDiscovery(
    await prisma.courseDiscovery.findUniqueOrThrow({ where: { id: discoveryId } }),
  );
}

export async function startCurrentUserCourseDiscovery(input: {
  discoveryId: string;
  expectedRevision: number;
}) {
  return startCourseDiscovery(input);
}

/** Revisiting an answer discards dependent later answers and uses the original server-owned question. */
export async function reviseCurrentUserCourseDiscovery({
  discoveryId,
  ...input
}: DiscoveryRevisionInput & { discoveryId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const parsed = discoveryRevisionInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" as const };
  }

  const discovery = await prisma.courseDiscovery.findFirst({
    where: { id: discoveryId, userId: session.user.id },
  });

  if (!discovery) {
    return { status: "notFound" as const };
  }

  if (
    discovery.revision !== input.expectedRevision ||
    !["ask", "ready", "failed"].includes(discovery.status) ||
    discovery.courseId
  ) {
    return { status: "conflict" as const };
  }

  const previous = discoveryAnswersSchema.parse(discovery.answers);
  const revised = previous[input.answerIndex];

  if (!revised) {
    return { status: "invalid" as const };
  }

  const answers = [
    ...previous.slice(0, input.answerIndex),
    { ...revised, answer: parsed.data.answerText },
  ];

  const claim = await prisma.courseDiscovery.updateMany({
    data: {
      answers,
      brief: databaseNull,
      nextQuestion: databaseNull,
      resolution: databaseNull,
      revision: { increment: 1 },
      status: "pending",
    },
    where: {
      courseId: null,
      id: discoveryId,
      revision: input.expectedRevision,
      status: { in: ["ask", "ready", "failed"] },
      userId: session.user.id,
    },
  });

  if (claim.count === 0) {
    return { status: "conflict" as const };
  }

  return runDiscovery({
    ...discovery,
    answers,
    revision: discovery.revision + 1,
    status: "pending",
  });
}
