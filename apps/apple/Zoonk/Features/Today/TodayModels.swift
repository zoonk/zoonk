import Foundation

enum TodayContent: Equatable, Sendable {
  case day(TodayView)
  case noGoal(suggestedGoal: SuggestedGoal?)
  case preparing(goalID: String, title: String)
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
    enum Kind: String, Decodable, Sendable {
      case exam
      case explain
      case language
      case learn
    }

    let dateEstimated: Bool
    let daysLeft: Int?
    let id: String
    let kind: Kind
    let targetDate: String?
    let title: String
  }

  struct Progress: Decodable, Equatable, Sendable {
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

  struct PlanStatus: Decodable, Equatable, Sendable {
    let challenges: Int?
    let days: Int?
    let kind: String
    let lessons: Int?
  }

  /// Core picks the one notice Today shows, the most pressing first.
  enum Notice: String, Decodable, Sendable {
    case exam
    case examAccess
    case examChoice
    case insight
    case planChange
    case practice
    case sourceChange
    case suggestedGoal
    case uploadRequest
  }

  /// One of the exam's choices the learner hasn't picked yet; the plan studies none of its options.
  struct ExamChoice: Decodable, Equatable, Sendable {
    struct Option: Decodable, Equatable, Sendable {
      let name: String
      let shortName: String?
    }

    let group: String
    let options: [Option]
  }

  struct MockFunding: Decodable, Equatable, Sendable {
    let mockDate: String
  }

  struct PlanChange: Decodable, Equatable, Sendable {
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
    let officialDate: OfficialDate?
    let reason: String?
    let source: String
    let status: String
    let todaySession: String?
  }

  struct Pattern: Decodable, Equatable, Sendable {
    let id: String
    /// `pattern`, or `typos` when the recent mistakes were slips.
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
  struct UploadRequest: Decodable, Equatable, Sendable {
    enum Reason: String, Decodable, Sendable {
      case classMaterial
      case noOfficialSource
      case unverified
    }

    let examDocument: ExamDocument
    let goalId: String
    let goalKind: Goal.Kind
    /// The goal's language, which uploads are read in.
    let language: String
    let reason: Reason
  }

  let earlierWork: [EarlierWork]
  let exam: ExamMoment?
  let examChoice: ExamChoice?
  let goal: Goal
  /// At most one, until it's answered.
  let insight: MemoryInsight?
  /// `ready`, `generating`, `notStarted` or `failed`, by lesson.
  let lessonStatus: [String: String]
  let mockFunding: MockFunding?
  let notice: Notice?
  let pattern: Pattern?
  let planChange: PlanChange?
  let progress: Progress?
  let session: StudyDay
  /// The newest change to the source material the goal follows, in a sentence.
  let sourceChange: String?
  let studiedToday: Bool
  let suggestedGoal: SuggestedGoal?
  let uploadRequest: UploadRequest?
  let weeklyChallenge: WeeklyChallenge?

  func isBeingWritten(_ block: StudyBlock) -> Bool {
    block.kind == .learn && block.lessonId.map { lessonStatus[$0] == "generating" } == true
  }

  /// Mirrors main's `useUpNextLessons`.
  var upNextLessons: [StudyDay.ExtraTime.Lesson] {
    let state = session.state

    guard !isPastDate, state == .done || state == .rest, session.extraTime.available else {
      return []
    }

    return session.extraTime.lessons
  }

  var isPastDate: Bool {
    let state = session.state
    return progress?.status?.kind == "pastDate" && (state == .rest || state == .ahead)
  }

  var isWaitingForLessons: Bool {
    let beingWritten = session.blocks.contains {
      ($0.status == .pending || $0.status == .active) && isBeingWritten($0)
    }

    return beingWritten || session.lessonsComing || session.state == .waiting
  }
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
        let title: String
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
