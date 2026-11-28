export type GoalUnderstandingRoute = "explain" | "goals" | "instrument" | "unclear" | "unsafe";
export type UnderstoodGoalKind = "exam" | "language" | "learn";
export type UnderstoodOwnLevel = "advanced" | "basic" | "intermediate" | "none";
export type UnderstoodPurpose = "careerChange" | "deep" | "other" | "overview" | "refresh" | "work";

/** Exams that are only passed or failed have none. */
export type UnderstoodExamTarget = "admission" | "position" | "score";

/** `booked`: each candidate books their own day, so no notice ever sets it. */
export type UnderstoodExamDay = "booked" | "official";

/** Every field present, null when the text didn't say. */
export type RawUnderstoodGoal = {
  contentCountry: string | null;
  countryDependent: boolean;
  displayName?: string;
  examDay: UnderstoodExamDay | null;
  examMonth: number | null;
  examName: string | null;
  examNotBooked: boolean;
  examOption: string | null;
  examSubjects: string[] | null;
  examTarget: UnderstoodExamTarget | null;
  examYear: number | null;
  institution: string | null;
  kind: UnderstoodGoalKind;
  level: string | null;
  nativeLanguage: string | null;
  ownLevel: UnderstoodOwnLevel | null;
  purpose: UnderstoodPurpose | null;
  reason: string | null;
  role: string | null;
  subject: string;
  targetCourse: string | null;
  targetDate: string | null;
  targetLanguage: string | null;
  targetPosition: string | null;
  targetScore: string | null;
  title: string;
};

export type RawGoalUnderstanding = {
  dailyMinutes: number | null;
  followUps: string[];
  goals: RawUnderstoodGoal[];
  instrument: string | null;
  question: string | null;
  route: GoalUnderstandingRoute;
  studyDays: number[] | null;
  studyTime: string | null;
  studyTimeNote: string | null;
};

/** Fields the text didn't give are undefined, never null. */
export type UnderstoodGoal = {
  /**
   * A learn goal's country, only when the learner's words named it or a place in it. An exam's, only
   * when their words name the country whose exam it is, or a body that implies it; never a place
   * they only sit it.
   */
  contentCountry?: string;
  /**
   * A learn goal whose subject changes by country, or an exam each country runs its own version of
   * that its name doesn't place. Languages take their country from their variety, so theirs is
   * always false.
   */
  countryDependent: boolean;
  displayName?: string;
  examDay?: UnderstoodExamDay;
  /** 1 to 12, for an exam named without its day ("in March"). */
  examMonth?: number;
  examName?: string;
  /** A test the learner books themselves and said they haven't booked yet. */
  examNotBooked?: true;
  /**
   * The version, discipline or specialty of the exam the learner states as theirs, in their words
   * ("Mechanical"); undefined when they doubt it, reject it or name several.
   */
  examOption?: string;
  /** The exam's subjects the learner prepares, in their words; undefined for the whole exam. */
  examSubjects?: string[];
  examTarget?: UnderstoodExamTarget;
  examYear?: number;
  institution?: string;
  kind: UnderstoodGoalKind;
  level?: string;
  nativeLanguage?: string;
  ownLevel?: UnderstoodOwnLevel;
  purpose?: UnderstoodPurpose;
  reason?: string;
  role?: string;
  subject: string;
  targetCourse?: string;
  targetDate?: string;
  targetLanguage?: string;
  /** A language goal's country, when the learner named one or a place where it's spoken. */
  targetRegion?: string;
  targetPosition?: string;
  targetScore?: string;
  title: string;
};

export type GoalUnderstanding =
  | { route: "explain"; question: string }
  | { instrument: string; route: "instrument" }
  | { route: "unclear" | "unsafe" }
  | {
      dailyMinutes?: number;
      followUps: string[];
      goals: UnderstoodGoal[];
      route: "goals";
      studyDays?: number[];
      studyTime?: string;
      studyTimeNote?: string;
    };
