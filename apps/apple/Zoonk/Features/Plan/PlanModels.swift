import Foundation

/// A goal's plan at every zoom level (`GET /goals/{goalId}/plan`), with what the Plan tab draws:
/// its phases in time with their chapters, this week day by day, the pace, the schedule the
/// learner set and its estimate. Recoded from the API's payload; every date is a calendar day.
struct GoalPlan: Decodable, Equatable, Sendable {
  struct Access: Decodable, Equatable, Sendable {
    /// A free exam plan past its first week: new lessons, challenges and mocks come with Plus.
    let freeWeekOver: Bool
    let mocksRequirePlus: Bool
  }

  struct Area: Decodable, Equatable, Identifiable, Sendable {
    let focused: Bool
    let name: String
    /// A part of another area, listed under it.
    let partOf: String?
    let pastBasics: Bool
    let reduced: Bool
    let skipped: Bool

    var id: String { name }
  }

  struct Course: Decodable, Equatable, Sendable {
    let brandSlug: String
    let courseId: String
    let courseSlug: String
    let title: String
  }

  struct End: Decodable, Equatable, Sendable {
    let kind: String
  }

  struct Estimate: Decodable, Equatable, Sendable {
    /// When the plan ends at this pace; nil while it can't tell.
    let endDate: String?
    /// When studying everything would end, for an exam plan that stops at the exam.
    let fullCourseEndDate: String?
  }

  /// A part of an exam where the learner takes one option of several (ENEM's foreign language).
  struct ExamChoice: Decodable, Hashable, Identifiable, Sendable {
    struct Option: Decodable, Equatable, Hashable, Sendable {
      let name: String
      let shortName: String?
    }

    let group: String
    let options: [Option]
    /// The option picked; nil until the learner picks, and the plan leaves the group out.
    let subject: String?

    var id: String { group }
  }

  /// What the learner's time covers by the goal's date.
  struct Feasibility: Decodable, Equatable, Sendable {
    let coreFits: Bool
    let coveredShare: Double
    let deadline: String?
    let deepensMostAsked: Bool
    let fits: Bool
    /// `exam` or `goal`.
    let measure: String
    let timeCovers: Bool
  }

  /// The lessons the learner's own time fits that the plan doesn't hold, ready to apply.
  struct FitOffer: Decodable, Equatable, Sendable {
    let canApply: Bool
    let fits: Bool
    let operations: [JSONValue]
  }

  /// Prerequisites to study before the topics that build on them, each with how deep.
  struct Bases: Decodable, Equatable, Sendable {
    struct Item: Decodable, Equatable, Identifiable, Sendable {
      struct Minutes: Decodable, Equatable, Sendable {
        let deep: Int
        let essential: Int
        let quick: Int
      }

      let area: String?
      let choice: BaseChoice
      let choices: [BaseChoice]
      let minutes: Minutes
      let name: String
      let skillId: String
      let studied: Bool

      var id: String { skillId }
    }

    let items: [Item]
  }

  struct Steering: Decodable, Equatable, Sendable {
    /// `easier`, `standard` or `harder`.
    let difficultyBias: String
    let lessonsStudied: Int
    /// `moreExplanation`, `balanced` or `morePractice`.
    let practiceBias: String
    /// A language plan's activities left out: `vocabulary`, `listening`, `writing`, `speaking`.
    let skippedActivities: [String]
  }

  /// A tool the plan's chapters use, with the learner's answer.
  struct Tool: Decodable, Equatable, Identifiable, Sendable {
    /// `have`, `setup` or `none`; nil until the learner answers.
    let choice: String?
    let essential: Bool
    let later: Bool
    let name: String
    let system: String?

    var id: String { name }
  }

  /// When an exam's written tests are practiced.
  struct WrittenPractice: Decodable, Equatable, Sendable {
    /// `weekly`, `biweekly` or `finalWeeks`.
    let cadence: String
    let parts: [String]
  }

  /// An exam plan built before research read its notice: `reading` while the reveal waits for
  /// it, `usual` once the wait ended without it.
  enum Notice: String, Decodable, Sendable {
    case reading
    case usual
  }

  /// The plan's own sums of the time it schedules, as the course's page and the time question
  /// read them.
  struct Numbers: Decodable, Equatable, Sendable {
    struct Context: Decodable, Equatable, Sendable {
      let targetDate: String?
    }

    /// What's scheduled before the goal's date; nil without one.
    let beforeDeadlineMinutes: Double?
    let context: Context
    /// Everything scheduled from today, after the date included.
    let scheduledMinutes: Double
  }

  struct Schedule: Decodable, Equatable, Sendable {
    /// The exam's day its notice gives, when the plan counts down to another.
    struct NoticeDay: Decodable, Equatable, Sendable {
      let date: String
      /// The likely day, while the edition's notice isn't out.
      let estimated: Bool
    }

    let dailyMinutes: Int
    let fullCourse: Bool
    let noticeDay: NoticeDay?
    let studyDays: Int
    let targetDate: String?
    let targetDateEstimated: Bool
    let targetDateNamedMonth: Bool
    /// Minutes for each weekday, Sunday first; 0 is a rest day.
    let weekdayMinutes: [Int]
  }

  /// The learner's pace against the plan.
  struct Status: Decodable, Equatable, Sendable {
    enum Kind: String, Decodable, Sendable {
      case ahead
      case behind
      case challengesLeft
      case finished
      case needsAdjusting
      case onTrack
      case pastDate
    }

    let challenges: Int?
    let days: Int?
    let extraMinutesPerDay: Int?
    let kind: Kind
    let lessons: Int?
  }

  struct Week: Decodable, Equatable, Sendable {
    let days: [PlanWeekDay]
    let startDate: String
  }

  struct WeekTime: Decodable, Equatable, Sendable {
    let studiedMinutes: Int
    let targetMinutes: Double
  }

  let access: Access
  let areas: [Area]
  let bases: Bases?
  let course: Course?
  /// Set once nothing of the plan is left.
  let end: End?
  let estimate: Estimate
  let examChoices: [ExamChoice]
  let examDocument: ExamDocument
  let feasibility: Feasibility?
  let fitOffer: FitOffer?
  let goalId: String
  let notice: Notice?
  /// Nil until the plan is computed.
  let numbers: Numbers?
  let phases: [PlanPhase]
  let planId: String
  let ready: Bool
  let schedule: Schedule
  let status: Status?
  let steering: Steering
  let tools: [Tool]
  let week: Week
  let weekTime: WeekTime
  let writtenPractice: WrittenPractice?

  /// The learner's today as the plan wrote its days.
  var today: String {
    week.days.first { $0.state == .today }?.date ?? week.startDate
  }

  /// The phases a drawing of the plan counts: studying after an exam comes past its finish, and a
  /// phase the plan holds nothing of has no days.
  var roadPhases: [PlanPhase] {
    phases.filter { $0.kind != .afterExam && $0.state != .leftOut }
  }

  /// The chapter holding the plan's next lesson, wherever it is on the path.
  var nextChapter: PlanChapter? {
    phases.lazy.flatMap(\.chapters).first { $0.state == .current }
  }
}

struct PlanPhase: Decodable, Equatable, Identifiable, Sendable {
  enum Kind: String, Decodable, Sendable {
    case afterExam
    case finalStretch
    case foundations
    case gaps
    case learn
    case practice
  }

  enum State: String, Decodable, Sendable {
    case current
    case done
    case leftOut
    case unfinished
    case upcoming
  }

  /// The challenge that closes the phase.
  struct Checkpoint: Decodable, Equatable, Sendable {
    enum State: String, Decodable, Sendable {
      case done
      case upcoming
    }

    enum When: String, Decodable, Sendable {
      case date
      case nextSession
      case queued
    }

    let date: String?
    let locked: Bool
    let planItemId: String
    let state: State
    let when: When
  }

  struct Mocks: Decodable, Equatable, Sendable {
    let count: Int
    let nextDate: String?
  }

  let chapters: [PlanChapter]
  let checkpoint: Checkpoint?
  let endDate: String?
  let index: Int
  let kind: Kind
  let lessonsDone: Int
  let lessonsTotal: Int
  let mocks: Mocks
  /// Exam phases come without a name; see `PlanPhase.title`.
  let name: String?
  let startDate: String?
  let state: State

  var id: Int { index }

  /// How far into the phase its lessons are: a done one is full.
  var lessonShare: Double {
    if state == .done {
      return 1
    }

    return lessonsTotal > 0 ? min(1, Double(lessonsDone) / Double(lessonsTotal)) : 0
  }
}

struct PlanChapter: Decodable, Equatable, Identifiable, Sendable {
  enum State: String, Decodable, Sendable {
    case current
    case done
    case upcoming
  }

  /// Nil for lessons still being written: they have no page yet.
  let chapterId: String?
  /// Going deeper into an earlier topic.
  let deeper: Bool
  /// Past the weeks the plan writes ahead: an outline the learner can ask for.
  let far: Bool
  let lessonsDone: Int
  let lessonsTotal: Int
  let skillId: String?
  let state: State
  let testedOut: Bool
  let title: String
  let writing: Bool

  var id: String { chapterId ?? skillId ?? title }
}

struct PlanWeekDay: Decodable, Equatable, Identifiable, Sendable {
  enum State: String, Decodable, Sendable {
    case done
    case missed
    case rest
    case today
    case upcoming
  }

  struct Item: Decodable, Equatable, Sendable {
    let status: String
  }

  let date: String
  let items: [Item]
  let state: State

  var id: String { date }

  /// How much of the day's plan is done, as its ring's arc.
  var share: Double {
    if state == .done {
      return 1
    }

    guard !items.isEmpty else {
      return 0
    }

    let done = items.filter { $0.status == "done" || $0.status == "testedOut" }.count
    return Double(done) / Double(items.count)
  }
}

/// How deep a prerequisite is studied.
enum BaseChoice: String, Codable, Sendable {
  case deep
  case essential
  case quick
  case skip
}

/// What to study once the plan is over: the next level of its course and the courses it drew from.
struct StudyNext: Decodable, Equatable, Sendable {
  struct NextLevel: Decodable, Equatable, Sendable {
    let level: String
    let title: String
  }

  struct Course: Decodable, Equatable, Identifiable, Sendable {
    let courseId: String
    let title: String

    var id: String { courseId }
  }

  let nextLevel: NextLevel?
  let related: [Course]
}

/// A language goal's level across skills (`GET /goals/{goalId}/language-progress`).
struct LanguageStanding: Decodable, Equatable, Sendable {
  struct Level: Decodable, Equatable, Sendable {
    let label: String
    let score: Double
    /// `reading`, `listening`, `speaking` or `writing`.
    let skill: String
  }

  struct Target: Decodable, Equatable, Sendable {
    let label: String
  }

  let level: String?
  let levels: [Level]
  let target: Target?
}

/// A language goal's units and its alphabet lesson (`GET /goals/{goalId}/language-units`).
struct LanguageUnitsOverview: Decodable, Equatable, Sendable {
  /// A script that isn't Latin: its alphabet lesson, first in the sessions while `pending`.
  struct Alphabet: Decodable, Equatable, Sendable {
    let lessonId: String
    let minutes: Int
    let pending: Bool
    let title: String
  }

  let alphabet: Alphabet?
}

/// The lessons of a topic past the weeks the plan writes ahead, outlined when the learner asks.
struct SkillOutline: Decodable, Equatable, Sendable {
  struct Chapter: Decodable, Equatable, Identifiable, Sendable {
    let chapterId: String
    let title: String

    var id: String { chapterId }
  }

  /// `available` (a tap outlines it), `writing` or `ready`.
  let status: String
  let chapters: [Chapter]
}

/// A plan read with when it was read, so returning to the Plan asks the cheap
/// `getPlanChangedSince` before reading the expensive plan again.
struct PlanRead: Equatable, Sendable {
  let plan: GoalPlan
  let readAt: Date
}

/// The goal's subjects or modules (`GET /goals/{goalId}/syllabus`); it also feeds search.
struct GoalSyllabus: Decodable, Equatable, Sendable {
  struct Goal: Decodable, Equatable, Sendable {
    let kind: String
  }

  struct Lessons: Decodable, Equatable, Sendable {
    let done: Int
    let known: Int
    let total: Int
  }

  let fromMaterial: Bool
  let goal: Goal
  /// `notice` (an exam's own subjects) or `modules`.
  let kind: String
  let lessons: Lessons
  let subjects: [SyllabusSubject]
  let topicCount: Int

  /// Whether the structure is worth its own section: an exam's subjects, or at least two modules.
  var hasSubjectPages: Bool {
    goal.kind == "exam" ? !subjects.isEmpty : subjects.count >= 2
  }
}

struct SyllabusSubject: Decodable, Equatable, Identifiable, Sendable {
  struct Chapter: Decodable, Equatable, Identifiable, Sendable {
    let chapterId: String?
    let far: Bool
    let known: Bool
    let lessonsDone: Int
    let lessonsTotal: Int
    let nextDate: String?
    let position: Int
    let skillId: String?
    let state: PlanChapter.State
    let title: String
    let writing: Bool

    var id: String { chapterId ?? skillId ?? "\(position)" }
  }

  /// An exam subject's first answers to unseen questions, once it has enough to count.
  struct Mastery: Decodable, Equatable, Sendable {
    let answered: Int
    let correct: Int
  }

  /// A topic as the notice lists it, with where the learner stands on it.
  struct Topic: Decodable, Equatable, Identifiable, Sendable {
    let chapters: [Chapter]
    /// `high` reads "Appears a lot".
    let frequency: String?
    let heading: String?
    let name: String
    let notPlannedReason: String?
    /// `studied`, `known`, `inProgress`, `toStudy` or `notPlanned`; nil when the plan doesn't map
    /// topics.
    let status: String?

    var id: String { (heading ?? "") + "/" + name }
  }

  let chapters: [Chapter]
  let key: String
  let lessonsDone: Int
  let lessonsKnown: Int
  let lessonsTotal: Int
  let mastery: Mastery?
  let name: String
  let nextDate: String?
  let notPlannedReason: String?
  let preparation: Double?
  let questions: Int?
  let source: String
  let topics: [Topic]
  let topicsStudied: Int?

  var id: String { key }

  /// A module's lessons studied or known, as its bar measures them.
  var lessonShare: Double {
    lessonsTotal > 0 ? Double(lessonsDone + lessonsKnown) / Double(lessonsTotal) : 0
  }
}

/// Where the learner stands on an exam or learn goal (`GET /goals/{goalId}/progress`).
struct GoalStanding: Decodable, Equatable, Sendable {
  struct Preparation: Decodable, Equatable, Sendable {
    struct Area: Decodable, Equatable, Identifiable, Sendable {
      let areaId: String
      let preparation: Double
      let title: String
      let weekGain: Double

      var id: String { areaId }
    }

    let areas: [Area]
    let value: Double
    let weekGain: Double
  }

  let preparation: Preparation?
}

/// "2027-11-14": a calendar day, as the plan writes its days. Read and shown in UTC so the day
/// never moves with the device's zone.
enum PlanDate {
  private static let calendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .gmt
    return calendar
  }()

  static func date(_ isoDate: String) -> Date? {
    let parts = isoDate.split(separator: "-").compactMap { Int($0) }

    guard parts.count == 3 else {
      return nil
    }

    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }

  static func days(from start: String, to end: String) -> Int {
    guard let start = date(start), let end = date(end) else {
      return 0
    }

    return calendar.dateComponents([.day], from: start, to: end).day ?? 0
  }

  /// "Nov 14", with the year when it isn't `today`'s; "November 2027" for a month.
  static func text(_ isoDate: String, today: String, month: Bool = false) -> String {
    guard let date = date(isoDate) else {
      return isoDate
    }

    var style = Date.FormatStyle(timeZone: .gmt)

    if month {
      return date.formatted(style.month(.wide).year())
    }

    style = style.month(.abbreviated).day()

    if isoDate.prefix(4) != today.prefix(4) {
      style = style.year()
    }

    return date.formatted(style)
  }

  /// A day picked in a GMT calendar as "2027-11-14".
  static func isoDate(_ date: Date) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  /// "March 3, 2027", or "March 2027" for a month: a goal's date inside a sentence.
  static func longText(_ isoDate: String, month: Bool = false) -> String {
    guard let date = date(isoDate) else {
      return isoDate
    }

    let style = Date.FormatStyle(timeZone: .gmt)
    return date.formatted(month ? style.month(.wide).year() : style.month(.wide).day().year())
  }

  /// "Mon": a day's short weekday.
  static func weekday(_ isoDate: String) -> String {
    date(isoDate)?.formatted(Date.FormatStyle(timeZone: .gmt).weekday(.abbreviated)) ?? ""
  }
}
