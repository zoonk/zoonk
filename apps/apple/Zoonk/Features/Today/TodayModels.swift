import Foundation

enum TodayContent: Equatable, Sendable {
  case day(TodayView)
  case noGoal(suggestedGoal: SuggestedGoal?)
  case preparing(goalID: String, displayName: String)
  /// The goal is paused, completed or archived.
  case goalNotActive
}

struct SuggestedGoal: Decodable, Equatable, Sendable {
  /// The course it continues, which starts on its own page.
  let courseId: String?
  let id: String
  let title: String
}

struct TodayView: Decodable, Equatable, Sendable {
  struct Goal: Decodable, Equatable, Sendable {
    enum Kind: String, UnknownAPIValue, Sendable {
      case unrecognized
      case exam
      case explain
      case language
      case learn
    }

    let dateEstimated: Bool
    let daysLeft: Int?
    /// Nil from a server that doesn't send it yet.
    let examDocument: ExamDocument?
    let id: String
    let kind: Kind
    let targetDate: String?
    let title: String
  }

  struct Progress: OmittableAPIContent, Equatable, Sendable {
    struct Lessons: Decodable, Equatable, Sendable {
      let done: Int
      let today: Int
      let total: Int
    }

    let lessons: Lessons?
    let measure: String
    let status: PlanStatus?
    let value: Double
    let weekGain: Double?
  }

  struct PlanStatus: OmittableAPIContent, Equatable, Sendable {
    let challenges: Int?
    let days: Int?
    let kind: String
    let lessons: Int?
  }

  /// Core picks the one notice Today shows, the most pressing first.
  enum Notice: String, OmittableAPIContent, Sendable {
    case exam
    case examChoice
    case focusTest
    case insight
    case planChange
    case practice
    case sourceChange
    case suggestedGoal
    case uploadRequest
  }

  /// One of the exam's choices the learner hasn't picked yet; the plan studies none of its options.
  struct ExamChoice: OmittableAPIContent, Equatable, Sendable {
    let group: String
    let leftOut: ExamChoiceLeftOut
    let options: [GoalPlan.ExamChoice.Option]
    let take: Int
  }

  struct MockFunding: Decodable, Equatable, Sendable {
    var planItemId: String?
    let mockDate: String
  }

  struct PlanChange: OmittableAPIContent, Equatable, Sendable {
    /// Set when missed days put the goal's date at risk.
    struct Behind: Decodable, Equatable, Sendable {
      let canFocus: Bool
      let coveredAfter: Double
      let coveredBefore: Double
      let currentMinutes: Int
      /// `exam` or `goal`.
      let measure: String
    }

    struct OfficialDate: Decodable, Equatable, Sendable {
      let date: String
    }

    let behind: Behind?
    let canApply: Bool
    let canUndo: Bool
    let effect: PlanEffect?
    let examDocument: ExamDocument
    let id: String
    let kind: String
    /// For `testedOut` and `relearn`: the lessons the learner's answers took out of the plan.
    let lessonsSkipped: Int
    let officialDate: OfficialDate?
    let operations: [PlanChangeOperation]
    let quote: PlanChangeQuote
    let reason: String?
    let source: String
    let status: String
    let todaySession: String?

    var setsFocus: Bool { operations.contains { $0.kind == "focusAreas" } }
  }

  struct Pattern: Decodable, Equatable, Sendable {
    let id: String
    /// Always `pattern`: Today takes no typos finding.
    let kind: String
    let title: String
  }

  struct WeeklyChallenge: Decodable, Equatable, Sendable {
    let access: String
    let date: String?
    let kind: String
    let planItemId: String?
    let questions: Int?
    let timeLimitMinutes: Int?

    var requiresPlus: Bool { access == "plusRequired" }
  }

  struct EarlierWork: Decodable, Equatable, Sendable {
    let title: String
  }

  /// The document research couldn't read, asked of the learner until they upload or dismiss it.
  struct UploadRequest: OmittableAPIContent, Equatable, Sendable {
    enum Reason: String, Decodable, Sendable {
      case classMaterial
      case noOfficialSource
      case unverified
    }

    struct UnreadableUpload: Decodable, Equatable, Sendable {
      let title: String
    }

    let examDocument: ExamDocument
    let goalId: String
    let goalKind: Goal.Kind
    /// The goal's language, which uploads are read in.
    let language: String
    let reason: Reason
    /// The upload that last answered it had nothing to read on it, so it's asked for again.
    let unreadableUpload: UnreadableUpload?
  }

  let earlierWork: [EarlierWork]
  let exam: ExamMoment?
  let examChoice: ExamChoice?
  /// The Focus test's first sitting, while Today suggests it.
  let focusTest: FocusTestSummary.Size?
  let goal: Goal
  /// At most one, until it's answered.
  let insight: MemoryInsight?
  let mockFunding: MockFunding?
  let notice: Notice?
  let pattern: Pattern?
  let planChange: PlanChange?
  let progress: Progress?
  var session: StudyDay
  /// The newest change to the source material the goal follows, in a sentence.
  let sourceChange: String?
  let studiedToday: Bool
  let suggestedGoal: SuggestedGoal?
  let uploadRequest: UploadRequest?
  let weeklyChallenge: WeeklyChallenge?

  func isBeingWritten(_ block: StudyBlock) -> Bool {
    block.kind == .learn && block.lesson?.status == .generating
  }

  /// Mirrors main's `useUpNextLessons`. Once extras are on the list, Continue plays them first.
  var upNextLessons: [StudyDay.ExtraTime.Lesson] {
    guard !isPastDate, session.extraTime.available else {
      return []
    }

    return session.extraTime.lessons
  }

  var isPastDate: Bool {
    let state = session.state
    return progress?.status?.kind == "pastDate" && (state == .rest || state == .ahead)
  }

  /// With `isAwaitingOutlines`, mirrors main's `isWaitingForLessons`.
  var writingLessonIDs: [String] {
    session.blocks.compactMap {
      ($0.status == .pending || $0.status == .active) && isBeingWritten($0) ? $0.lessonId : nil
    }
  }

  var isAwaitingOutlines: Bool {
    session.lessonsComing || session.state == .waiting
  }

  /// Main's `useDayState`: a wait for the day's lessons that ran out asks for them, as a day nobody
  /// is preparing does.
  func shownState(writingStalled: Bool) -> DayState {
    session.state == .waiting && writingStalled ? .prepare : session.state
  }
}

enum UploadAnswer: Equatable, Sendable {
  case answered
  /// Research read these uploads for an earlier ask (`UPLOAD_ALREADY_READ`).
  case alreadyRead
  /// Nothing could be read on them (`UPLOAD_UNREADABLE`).
  case unreadable
}

struct APIProblem: Decodable, Sendable {
  struct Body: Decodable, Sendable {
    let code: String
  }

  let error: Body
}

struct TodayProblem: Decodable, Sendable {
  struct Body: Decodable, Sendable {
    struct Details: Decodable, Sendable {
      struct Goal: Decodable, Sendable {
        let id: String
        let displayName: String
      }

      let goal: Goal?
      let suggestedGoal: SuggestedGoal?
    }

    let code: String
    let details: Details?
  }

  let error: Body
}

/// A language goal's practice beside the day.
struct LanguageTodayView: Decodable, Equatable, Sendable {
  struct Pronunciation: Decodable, Equatable, Sendable {
    let count: Int
    /// The first few.
    let words: [String]
  }

  struct Speaking: Decodable, Equatable, Sendable {
    /// `open`, `plusRequired` or `callsPaused`.
    let access: String
    /// The paper's exam and level, "B1 Preliminary".
    let title: String
  }

  let pronunciation: Pronunciation?
  let speaking: Speaking?
}
