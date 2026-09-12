import "server-only";
import { resolveLearningRequest as classifyLearningRequest } from "@zoonk/ai/tasks/courses/request";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { getSession } from "../users/get-session";
import { learningRequestIdentity } from "./_utils/learning-request-identity";
import { claimLearningRequestQuota } from "./_utils/learning-request-quota";
import { resolveReusableLearningSubject } from "./_utils/reusable-learning-request";
import { createCurrentUserCourseDiscovery } from "./discovery";
import { learningRequestInputSchema } from "./discovery-contract";

/** Private requests never enter the public prompt cache. Guests can find already available exact subjects. */
export async function resolveLearningRequest(input: { language: string; prompt: string }) {
  const parsed = learningRequestInputSchema.safeParse(input);

  if (!parsed.success) {
    return { kind: "invalid" as const };
  }

  const session = await getSession();

  if (!session) {
    const existing = await prisma.course.findFirst({
      include: { organization: true },
      where: {
        isPublished: true,
        language: parsed.data.language,
        normalizedTitle: normalizeString(parsed.data.prompt),
        organization: { kind: "brand" },
        userId: null,
      },
    });

    return existing
      ? {
          course: {
            brandSlug: existing.organization?.slug ?? "",
            format: existing.format,
            id: existing.id,
            slug: existing.slug,
          },
          kind: "course" as const,
        }
      : { kind: "unauthorized" as const };
  }

  const quota = await claimLearningRequestQuota();

  if (quota.status !== "ready") {
    return { ...quota, kind: quota.status };
  }

  const result = await classifyLearningRequest(parsed.data);

  if (result.data.intent === "unsafe" || result.data.intent === "exam") {
    return { kind: result.data.intent };
  }

  if (
    result.data.subjects.length === 0 ||
    result.data.subjects.some((subject) => subject.requiresDiscovery)
  ) {
    const discovery = await createCurrentUserCourseDiscovery(parsed.data);

    return discovery.status === "ready"
      ? { discoveryId: discovery.discovery.id, kind: "discovery" as const }
      : { ...discovery, kind: discovery.status };
  }

  const subjects = result.data.subjects;

  const resolvedTargets = await Promise.all(
    subjects.map((subject) =>
      resolveReusableLearningSubject({ language: parsed.data.language, subject }),
    ),
  );

  const targets = resolvedTargets.filter(
    (target, index) =>
      resolvedTargets.findIndex(
        (candidate) =>
          candidate.kind === target.kind &&
          (candidate.kind === "course" ? candidate.course.id : candidate.prompt.id) ===
            (target.kind === "course" ? target.course.id : target.prompt.id),
      ) === index,
  );

  if (targets.length === 1 && targets[0]) {
    return targets[0];
  }

  const id = learningRequestIdentity({ ...parsed.data, kind: "track", userId: session.user.id });

  const track = await prisma.track.upsert({
    create: {
      courses: {
        create: targets.flatMap((target, position) =>
          target.kind === "course" ? [{ courseId: target.course.id, position }] : [],
        ),
      },
      id,
      request: {
        language: parsed.data.language,
        prompt: parsed.data.prompt,
        subjects: targets.map((target, position) => ({
          title:
            target.kind === "generate"
              ? target.prompt.canonicalTitle
              : (subjects[resolvedTargets.indexOf(target)]?.title ?? "Course"),
          ...(targets[position]?.kind === "generate"
            ? { coursePromptId: targets[position].prompt.id }
            : {
                courseId: targets[position]?.kind === "course" ? targets[position].course.id : null,
              }),
        })),
      },
      title: result.data.trackTitle ?? subjects.map((subject) => subject.title).join(" & "),
      userId: session.user.id,
    },
    update: {},
    where: { id },
  });

  return { kind: "track" as const, trackId: track.id };
}
