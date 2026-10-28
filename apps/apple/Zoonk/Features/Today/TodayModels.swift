import Foundation

/// What Today shows for the learner's active goal: the day, or one of the states before there is
/// one (no goal yet, its plan being built, a paused goal).
enum TodayContent: Equatable, Sendable {
  case day(TodayView)
  /// No active goal: Today starts one, offering a goal from the learner's last course first.
  case noGoal(suggestedGoal: SuggestedGoal?)
  /// The goal's plan is being built after onboarding: Today waits and asks again.
  case preparing(goalID: String, title: String)
  /// The goal is paused, completed or archived.
  case goalNotActive
}

/// A goal Today offers a learner without one, from the course they were taking before goals.
struct SuggestedGoal: Decodable, Equatable, Sendable {
  let id: String
  let title: String
}

/// Today for a goal (`GET /v1/today`): the goal, where its plan stands, the day, and what Today
/// shows beside it.
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
    let title: String
  }

  /// Where the plan stands in the goal's one measure.
  struct Progress: Decodable, Equatable, Sendable {
    let status: PlanStatus?
  }

  struct PlanStatus: Decodable, Equatable, Sendable {
    let challenges: Int?
    let days: Int?
    let kind: String
    let lessons: Int?
  }

  /// The exam's own days, said in the date line.
  struct ExamMoment: Decodable, Equatable, Sendable {
    let examName: String
    let stage: String
  }

  struct MockFunding: Decodable, Equatable, Sendable {
    let mockDate: String
  }

  /// One insight from recent sessions, until the learner answers it.
  struct Insight: Decodable, Equatable, Sendable {
    struct PlanChange: Decodable, Equatable, Sendable {
      let status: String
    }

    let id: String
    let kind: String
    let message: String
    let planChange: PlanChange?
    let studyTime: String?
  }

  /// A plan change the learner has a say in.
  struct PlanChange: Decodable, Equatable, Sendable {
    let id: String
    let reason: String?
    let status: String
  }

  /// A language goal's pattern noticed in recent mistakes.
  struct Pattern: Decodable, Equatable, Sendable {
    let id: String
    let title: String
  }

  /// The week's challenge or mock exam ahead.
  struct WeeklyChallenge: Decodable, Equatable, Sendable {
    let access: String
    let date: String?
    let kind: String
    let planItemId: String?

    var requiresPlus: Bool { access == "plusRequired" }
  }

  struct EarlierWork: Decodable, Equatable, Sendable {
    let title: String
  }

  let earlierWork: [EarlierWork]
  let exam: ExamMoment?
  let goal: Goal
  let insight: Insight?
  /// Where each lesson of the day's learn blocks stands: `ready`, `generating`, `notStarted`,
  /// `failed`.
  let lessonStatus: [String: String]
  let mockFunding: MockFunding?
  let pattern: Pattern?
  let planChange: PlanChange?
  let progress: Progress?
  let session: StudyDay
  let studiedToday: Bool
  let weeklyChallenge: WeeklyChallenge?

  /// Whether a block's lesson is being written right now.
  func isBeingWritten(_ block: StudyBlock) -> Bool {
    block.kind == .learn && block.lessonId.map { lessonStatus[$0] == "generating" } == true
  }

  /// Whether a learn block's lesson is ready to play; nil when Today holds no state for it.
  func isLessonReady(_ block: StudyBlock) -> Bool? {
    guard let lessonId = block.lessonId, let status = lessonStatus[lessonId] else {
      return nil
    }

    return status == "ready"
  }

  /// The plan's next lessons "Keep learning" adds, on a day with nothing left to start (main's
  /// `useUpNextLessons`).
  var upNextLessons: [StudyDay.ExtraTime.Lesson] {
    let state = session.state

    guard !isPastDate, state == .done || state == .rest, session.extraTime.available else {
      return []
    }

    return session.extraTime.lessons
  }

  /// The goal's date came with lessons left and today has nothing planned: the Plan is the way on.
  var isPastDate: Bool {
    let state = session.state
    return progress?.status?.kind == "pastDate" && (state == .rest || state == .ahead)
  }

  /// Whether Today waits for lessons to be written, so it reads itself again meanwhile.
  var isWaitingForLessons: Bool {
    let beingWritten = session.blocks.contains {
      ($0.status == .pending || $0.status == .active) && isBeingWritten($0)
    }

    return beingWritten || session.lessonsComing || session.state == .waiting
  }
}

/// The API's error body, for the codes Today and the session act on.
struct APIProblem: Decodable, Sendable {
  struct Body: Decodable, Sendable {
    let code: String
  }

  let error: Body
}

/// Today's error bodies that carry what to show instead of the day.
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
