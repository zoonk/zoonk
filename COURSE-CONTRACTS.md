# Implemented domain contracts

This is the current implementation checkpoint, updated after the backend review. `PROBLEMS.md` is the source of truth; it remains untracked and must survive all task continuations. `COURSE-DOMAIN-CONTRACTS.md` was the pre-implementation proposal and now points here. Production behavior lives in the typed Core leaves and generated Prisma schema, not this document.

## Persistence and replacement

- One Course identity owns one current curriculum. `curriculumVersion=2` is the new generation contract; `contentRevision` is the monotonic content concurrency token. Legacy rows remain readable until an explicit new setup/refresh start. Legacy coding/instrument/practical become core on install; exam stays unsupported.
- Chapter stores an authored level, generation-local concept key, outcomes, and prerequisite IDs. Core levels are overview/basic/intermediate/advanced; language levels are a1/a2/b1/b2/c1/c2. Only Overview has 3–6 chapters; Question has exactly one. Other chapter and lesson lists are uncapped.
- CourseLearningPlan has one row per user/course (`userCoursePlan`), depth overview/complete/focused, goal, startingKnowledge, startingLevel, dailyMinutes, hiddenLessonKinds, ordered chapterIds, summary, contentRevision, revision. The chapter array is the selected existing curriculum, not duplicate content.
- CourseDiscovery holds the private original prompt, trusted question/answers, resolution/brief, revision, status, and optional bound course/run. Track holds an owner-scoped ordered request; TrackCourse keeps actual course memberships, with unique course and position per Track. Pending members reference server-created CoursePrompt IDs from that same owned request.
- ChapterGenerationGrant uniquely identifies user/chapter sponsorship, covering all missing contained lessons permanently. User-owned courses have organizationId=null; the private delivery namespace is `brandSlug="me"`, resolved through the current session.
- Lesson.sourceLessonId links optional quiz/practice to its teaching source. Optional activities do not contribute to required-path denominators or suppress further teaching.
- LessonProgress, StepAttempt, ChapterCompletion, CourseCompletion have nullable content links with SetNull and trusted snapshots. History survives replacement; an old badge never completes newly generated material.
- LessonCompletionReceipt uniquely keys authenticated user + original lesson UUID + startedAt (`userOriginalLessonStartedAt`), stores the authoritative full completion result, and has no content FK. Network retries replay the receipt without duplicate BP, energy, attempts, or daily totals. It survives curriculum replacement.

`workflows/internal/course-curriculum` exports:

```ts
type CourseRevisionContext = {
  courseId: string;
  contentRevision: number;
  workflowRunId?: string;
  target?: { kind: "chapter" | "lesson"; id: string };
};
type PlannedCourseChapter = {
  key: string;
  title: string;
  description: string;
  level: CourseLevel | null;
  outcomes: string[];
  prerequisiteKeys?: string[];
};
withCurrentCourseRevision({ context, operation, transactionOptions?: { maxWait?, timeout? } });
// applied { value } | superseded
replaceCourseCurriculum({ context, curriculumVersion, chapters: PlannedCourseChapter[] });
// replaced { chapters, contentRevision } | superseded
```

All descendant writes share the stable Course row lock. Replacement validates the complete outline and prerequisite mapping, snapshots history, atomically replaces descendants, and increments revision. An identical durable install replay from the same persisted workflow run returns the installed rows; a stale different run cannot write. No model or asset call occurs under the transaction. Sync-content preserves/remaps plans, Tracks, discovery links, chapter grants, and durable history; changed-revision history stays detached. Receipts remain untouched.

## Learning plans and progress

Client-safe `courses/learning-plan-contract` exports `coursePlanInputSchema` and `CoursePlanInput`; imports from Prisma are type-only. Inputs: depth required; goal/startingKnowledge optional nullable trimmed text; startingLevel optional nullable; dailyMinutes optional nullable positive integer; hiddenLessonKinds optional list. `courses/learning-plan` exports:

- `getCurrentUserCoursePlan({courseId})`: unauthorized/notFound/ready {plan|null}; reads only course access and plan.
- `getCourseLearningPath({courseId,preferences?})`: notFound/invalid/ready {plan,chapters,progress,nextTarget,needsPlan,needsCurriculumUpdate}.
- `getCourseLearningPaths({courseIds,preferences?})`: batched results in input order. Tracks use this to avoid per-course curriculum queries.
- `updateCurrentUserCoursePlan({courseId,input,expectedRevision?})`: unauthorized/notFound/invalid/conflict/ready {plan}. Focused AI receives the real eligible chapter catalog; selection is validated and prerequisite-closed. Current plan selection is reused when only pacing/format preferences change. Writes compare both plan and course revisions after the AI call.
- `startCurrentUserCourse({courseId,input?,expectedRevision?})`: capability outcomes above, ready learning path, or generationRequired {resource:"curriculum",resourceId,courseId,contentRevision}. Explicit starts enroll and save/recompute a selected path. No-input legacy Continue preserves legacy content; explicit fresh preferences trigger refresh. A stale focused path requires actual recomputation and exposes no invented default next target.

Each path chapter has ordered required `lessons` with `isCompleted`, plus completedLessons/totalLessons/isCompleted. Path progress has completedChapters/totalChapters/completedLessons/totalLessons. Unknown empty chapter outlines remain pending, never falsely complete. Chapters containing only intentionally hidden teaching modes are excluded; rejecting all available teaching prevents an empty false completion. Explicit preview preferences override saved preferences. Default new core previews Overview, language starts A1 with self-assessment choices, legacy remains readable.

```ts
type CourseLearningTarget = {
  brandSlug: string;
  courseId: string;
  courseSlug: string;
  chapterId: string;
  chapterSlug: string;
  lessonId?: string;
  lessonSlug?: string;
  generationStatus: "pending" | "running" | "completed" | "failed";
};
```

Continuation, preload, progress, and API/native consumers use selected required content. Optional activities continue from their source teaching lesson even when appended later in the chapter. Whole-course historical completion is distinct from completing an Overview/focused path.

The source clarification treats `dailyMinutes` as an internal commitment signal. It never caps study or triggers a completion/over-target notice. The proposed daily pace suggestion and its capability/API were removed.

## Discovery and Tracks

`courses/discovery-contract` is the shared client-safe input/JSON schema leaf. `courses/discovery` exports create/get/answer/retry/revise/start current-user discovery capabilities. All require authentication and owner visibility. Answer accepts expectedRevision, questionId, and exactly one of optionId/otherAnswer/skip; skip is valid only for an optional trusted question. Revision accepts answerIndex/answerText/expectedRevision, retains server-owned question text, truncates dependent later answers, and recomputes material questions. Completed/generated courses cannot be revised.

Discovery resource: id/language/prompt/answers/brief/question/revision/status/courseId/generationTarget. States: pending/ask/ready/generating/completed/blocked/failed. A pending claim older than three minutes is projected as retryable failed; retry claims a new revision, invalidating a late old answer. There is no lifetime question cap. Starts recheck the complete material brief against unsafe/exam scope, then bind a private course or a reusable shared subject with an owner-specific focused path. CAS prevents a stale edited brief from applying old preferences. Shared CoursePrompt stores only the safe reusable subject; the original prompt remains private.

`courses/learning-request` exports `resolveLearningRequest({language,prompt})`: invalid/unauthorized/limitReached, course, generate, discovery, track, unsafe, exam. Guests may resolve exact existing public content; otherwise authentication occurs before AI/shared persistence. Resolved aliases collapse to one course identity. Distinct subjects yield a retry-stable owner Track; pending aliases also collapse if later generated requests reuse the same course.

`courses/tracks` exports list/get/create/update/remove/start current-user Track capabilities. Create takes title/courseIds. Update takes `{trackId,input}` with title and either courseIds or ordered `members:({courseId}|{coursePromptId})[]`; duplicates and unrelated pending prompt injection are rejected. Pending members can be reordered/removed without generating future courses first. Changes compare updatedAt under a Track lock. Removal keeps all enrollments/history. Start stops at the first unresolved required member or starts its next selected path.

TrackResource: id/title/createdAt/updatedAt, ordered course summaries with position/brandSlug/progress, pendingCourses with title/coursePromptId/position, aggregate progress (completedCourses/totalCourses/completedLessons/totalLessons/pendingChapters), nextTarget. Dates are Date in Core and ISO in HTTP. List uses UUID cursor pagination.

`users/learning-profile` get/update capabilities preserve unrelated profile fields. `users/learning-profile-contract` owns the interests schema. Global interests affect private discovery/example context; they never enter shared course identity or curriculum metadata.

## Generation and access

All generated published public content is readable for guests and free users at any position. Private content is readable only by its owner, including route IDs/slugs, player, generation views/events, and descendants. Public catalog predicates explicitly exclude user-owned courses. Read/preview/status capabilities do not consume quotas or create content. Generation requires authentication.

Free allowance is three distinct sponsored chapters per UTC month; paid allowance is 20/day and 100/month. Chapter grants persist across months. The first missing lesson in an already outlined chapter claims its user's grant; subsequent contained lessons reuse it. Joining the same in-flight target consumes no second grant. Course and lesson operational limits remain separate. Learning request/discovery/focused-path AI has a resettable daily operational budget of 100 free / 500 paid requests, with no lifetime question count.

`workflows/course-curriculum-generation-access` exposes read view and explicit access. A current curriculum needs no generation; legacy or empty content does. `workflows/generation-read-access` checks persisted run ownership/public scope; unknown/unmapped runs are denied. A GenerationRun registry records each trusted workflow start before HTTP202, independently of mutable generation claims, so immediate and failed run status/events keep the same resource authorization. Registration is internal after authenticated access; immutable run IDs cannot be rebound, resource deletion revokes access.

`lessons/optional-activities` exposes get/read and explicit start. Allowed teaching sources are explanation/tutorial/custom; language retains its own teaching modes. Reads create nothing. Start reuses a linked or adjacent legacy quiz/practice, otherwise creates one pending optional shell under the Course lock. The normal lesson generation API owns quota/workflow start.

## Verification checkpoint (not whole-product completion)

Updated 2026-09-12 11:12 local. After the source-directed removal of pace notifications, focused-path operational quota, complete-curriculum navigation, completion receipts, and generation registration:

- Core: 832 tests across 112 files passed, run sequentially with maxWorkers=4.
- API unit/workflow: 409 tests across 106 files passed with maxWorkers=4.
- Production API E2E build passed; containing HTTP suite passed182/182. A subsequent narrow fix registers derived preload runs too; API typecheck/rebuild and affected lesson HTTP suite passed20/20, including immediate read of returned preload generation ID.
- DB sync-content: 2 real-database rollback tests passed for identical/replaced curriculum revisions, nonzero/zero/null answer counts, plan/Track/discovery/grant restoration, and completion receipt preservation.
- Core/DB/API typechecks, backend lint, generated OpenAPI check, and scoped git diff whitespace check passed. No files staged or committed. PROBLEMS.md is still untracked in the repository root.

One attempted concurrent containing Core+API run exhausted the local PostgreSQL connection limit (`too many clients already`). It was diagnosed from the actual error, then replaced by sequential bounded runs above; no database reset or server configuration change was used. Old HTTP fixture assumptions about first-chapter paid access and coarse cached private classifications were updated to the accepted access/privacy behavior and exercised. API test workflows use the local test provider configuration; these results do not claim production paid-model content quality.

Main/native/browser/accessibility/visual/content-quality review remain root/content/UX lanes. These backend checks establish the exercised contracts and do not alone satisfy the complete product definition of done.
