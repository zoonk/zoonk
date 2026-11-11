const excludedModels = ["Verification", "RestoreKey", "AppAttestKey"];

const strippedFields: Readonly<Record<string, readonly string[]>> = {
  Account: ["accessToken", "refreshToken", "idToken", "password"],
  AnonymousMockAnswer: ["mockKey", "learnerKey"],
  Session: ["token"],
  // Google Play stores its purchase token in this shared provider field.
  Subscription: ["providerSubscriptionId"],
};

const reviewedFields: Readonly<Record<string, readonly string[]>> = {
  Account: ["accessTokenExpiresAt", "refreshTokenExpiresAt"],
  AiCall: [
    "credential",
    "inputTokens",
    "cacheReadTokens",
    "cacheWriteTokens",
    "outputTokens",
    "reasoningTokens",
  ],
  Certificate: ["key", "code"],
  Chapter: ["identityKey"],
  Course: ["uncomparableNotesHash"],
  EvaluationRun: ["inputHash"],
  ExamBlueprint: ["identityKey"],
  ExamCourseWeights: ["targetKey"],
  FollowUp: ["key"],
  Item: ["sourceHash"],
  LanguageSkillGraph: ["promptKey"],
  Lesson: ["identityKey"],
  LessonQuestionThread: ["subjectKey"],
  MediaAsset: ["reuseKey"],
  MemoryInsight: ["inputHash"],
  Milestone: ["key"],
  Plan: ["inputsKey"],
  Product: ["releasesHash", "unreadableReleasesHash"],
  RateLimit: ["key"],
  Skill: ["identityKey"],
  Source: ["identityKey", "contentHash", "unnoticedFromHash"],
  SourceChangeNotice: ["previousHash", "contentHash"],
  StepExampleLine: ["contextKey"],
  StepSource: ["contentHash"],
  StepVariant: ["key"],
  TargetCutoff: ["targetKey"],
  TestSubmissionClaim: ["key"],
  WarmUp: ["identityKey"],
};

export const staffCredentialPolicy = { excludedModels, reviewedFields, strippedFields };
