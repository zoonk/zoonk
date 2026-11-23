import Foundation
import SwiftUI

/// Every date is a calendar day.
struct GoalPlan: Decodable, Equatable, Sendable {
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
    let brandSlug: String?
    let chapterCount: Int
    let courseId: String
    let courseSlug: String
    let planChapterCount: Int
    let title: String
  }

  struct End: Decodable, Equatable, Sendable {
    let finishedOn: String?
    let kind: String
  }

  struct Estimate: Decodable, Equatable, Sendable {
    /// When the plan ends at this pace; nil while it can't tell.
    let endDate: String?
    /// When studying everything would end, for an exam plan that stops at the exam.
    let fullCourseEndDate: String?
  }

  struct ExamChoice: Decodable, Hashable, Identifiable, Sendable {
    struct Option: Decodable, Equatable, Hashable, Sendable {
      let name: String
      let shortName: String?
    }

    let group: String
    let leftOut: ExamChoiceLeftOut
    let options: [Option]
    /// The options picked, in the notice's order; empty until the learner picks, and the plan
    /// leaves the group out.
    let subjects: [String]
    let take: Int

    var id: String { group }
  }

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

  /// A change the plan offers because it fits the learner's time: more lessons, or the exam's
  /// optional study.
  struct Offer: Decodable, Equatable, Sendable {
    let canApply: Bool
    let effect: PlanEffect
    let fits: Bool
    /// The optional lessons the extra offer adds; nil on the fit offer.
    let lessons: Int?
    let operations: [JSONValue]
  }

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

  struct Tool: Decodable, Equatable, Identifiable, Sendable {
    /// `have`, `setup` or `none`; nil until the learner answers.
    let choice: String?
    let essential: Bool
    let later: Bool
    let name: String
    let system: String?

    var id: String { name }
  }

  struct WrittenPractice: Decodable, Equatable, Sendable {
    /// A written part's page: where the learner stands in points, how the answers move, and each
    /// first answer.
    struct Subject: Decodable, Equatable, Sendable {
      struct Answer: Decodable, Equatable, Identifiable, Sendable {
        /// How a levels answer went; nil on a points answer.
        struct Criteria: Decodable, Equatable, Sendable {
          let complete: Int
          let total: Int
        }

        let attemptId: String
        let criteria: Criteria?
        let date: String
        let decimals: Int?
        /// The server's count of the lines sent; nil on answers from before it was counted.
        let estimatedLines: Int?
        let lines: Int?
        let range: WritingRange?
        let taskKey: String
        let title: String
        let unit: WritingPrompt.Unit?
        let versions: Int

        var id: String { attemptId }
      }

      /// Unknown shares are nil.
      struct Sample: Decodable, Equatable, Sendable {
        let contentShare: Double?
        let date: String
        let errors: Int
        let presentationShare: Double?
      }

      /// What "Write" starts: each task, and whether it's open now, continues an unfinished block
      /// or waits for tomorrow's grades.
      struct WriteAction: Decodable, Equatable, Sendable {
        let availability: WritingAvailability
        let blockId: String?
        let taskKey: String
        let writingTask: WritingTaskName?
      }

      let answers: [Answer]
      /// Set when the whole part waits for an exam choice; a server without write actions says it
      /// only here.
      let availability: WritingAvailability?
      let decimals: Int?
      let minutes: Int?
      let points: WrittenPartPoints
      let questions: Int?
      /// Nil from a server before it said; then a part measured in points is in points.
      let scale: WritingScale?
      let share: Double?
      let trend: [Sample]
      let writeActions: [WriteAction]?

      /// The unfinished task to continue, if any.
      var unfinished: WriteAction? {
        writeActions?.first { $0.availability == .continue && $0.blockId != nil }
      }

      /// Whether answers can be estimated in points.
      var shownScale: WritingScale {
        scale ?? (points.range != nil || answers.contains { $0.range != nil } ? .points : .levels)
      }

      /// When every task's grading is used up for today, the first day one returns.
      var returnsOn: String? {
        guard let writeActions, !writeActions.isEmpty else { return nil }
        let days = writeActions.compactMap(\.availability.returnsOn)
        return days.count == writeActions.count ? days.min() : nil
      }

      /// The exam choices some tasks wait for, whether every task does, and the one waiting task's
      /// name when the others don't.
      var pendingChoice: (groups: [String], all: Bool, task: String?)? {
        guard let writeActions, !writeActions.isEmpty else {
          return availability?.choiceGroups.map { ($0, true, nil) }
        }

        let waiting = writeActions.filter { $0.availability.choiceGroups != nil }
        let groups = waiting.flatMap { $0.availability.choiceGroups ?? [] }
        guard !groups.isEmpty else { return nil }

        let task = waiting.count == 1 ? waiting.first : nil
        let name = task.map { action in
          WritingLabels.taskName(
            action.writingTask,
            title: points.tasks.first { $0.key == action.taskKey }?.name ?? "")
        }

        return (
          groups.reduce(into: []) { if !$0.contains($1) { $0.append($1) } },
          waiting.count == writeActions.count, name
        )
      }
    }

    /// `weekly`, `biweekly` or `finalWeeks`.
    let cadence: String
    let parts: [String]
    let subjects: [Subject]?

    func subject(for subject: SyllabusSubject) -> Subject? {
      subjects?.first { $0.points.name == subject.writtenPart }
        ?? subjects?.first { written in subject.areas.contains(written.points.name) }
        ?? subjects?.first { $0.points.name == subject.group }
    }
  }

  /// An exam plan built before research read its notice: `reading` while the reveal waits for
  /// it, `usual` once the wait ended without it.
  enum Notice: String, Decodable, Sendable {
    case reading
    case usual
  }

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
    struct MockSchedule: Decodable, Equatable, Sendable {
      let count: Int
      let everyWeeks: Int?
      let nextDate: String
      /// Sunday counted 0.
      let weekday: Int?
    }

    /// The exam's day its notice gives, when the plan counts down to another.
    struct NoticeDay: Decodable, Equatable, Sendable {
      let date: String
      /// The likely day, while the edition's notice isn't out.
      let estimated: Bool
    }

    let dailyMinutes: Int
    /// When the plan's mock exams come: on a weekday, or next on a day.
    let mocks: MockSchedule?
    /// Core's daily times for the time a day's picker.
    let dailyTimes: [Int]
    let fullCourse: Bool
    /// The month the learner named has no sitting; the closest ones to switch to.
    let noSitting: ExamView.NoSitting?
    let noticeDay: NoticeDay?
    let shape: WeekShape
    let studyDays: Int
    let targetDate: String?
    let targetDateEstimated: Bool
    let targetDateNamedMonth: Bool
    /// Minutes for each weekday, Sunday first; 0 is a rest day.
    let weekdayMinutes: [Int]
  }

  /// What a weekend time of its own still needs: a weekend day to use it and a weekday whose time
  /// it differs from (main's `getMissingDays`).
  enum WeekendMissingDays: Equatable {
    case weekend
    case weekdays

    /// From each weekday's minutes, Sunday first; nil when the week has both.
    static func of(_ weekdayMinutes: [Int]) -> WeekendMissingDays? {
      let studied = weekdayMinutes.indices.filter { weekdayMinutes[$0] > 0 }
      let isWeekend = { (day: Int) in day == 0 || day == 6 }

      if !studied.contains(where: isWeekend) {
        return .weekend
      }

      return studied.contains { !isWeekend($0) } ? nil : .weekdays
    }
  }

  /// Sunday counted 0.
  struct WeekShape: Decodable, Equatable, Sendable {
    let canDiffer: Bool
    let weekdayDays: [Int]
    let weekdays: Int
    /// The weekend's own time, or nil when it takes the weekdays' time.
    let weekend: Int?
    let weekendDays: [Int]

    func minutes(for weekday: Int) -> Int {
      [0, 6].contains(weekday) ? weekend ?? weekdays : weekdays
    }
  }

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

  let areas: [Area]
  let bases: Bases?
  let course: Course?

  var libraryCourse: Course? {
    guard let course, course.brandSlug != nil, course.planChapterCount > 0 else {
      return nil
    }

    return course
  }
  /// Set once nothing of the plan is left.
  let end: End?
  let estimate: Estimate
  let examChoices: [ExamChoice]
  let examDocument: ExamDocument
  /// The exam's optional study, offered only when all of it fits and the fit offer has nothing.
  let extraOffer: Offer?
  let feasibility: Feasibility?
  let fitOffer: Offer?
  /// The exam has an official guide or the learner's material, so optional study is "Not in the
  /// official guide" rather than "Optional".
  let hasNotice: Bool?
  /// An exam goal's Focus test; nil for other goals.
  var focusTest: FocusTestSummary?
  let goalId: String
  /// A language goal's level the course goes up to and the aims to change it to; nil for others.
  let languageAim: LanguageAimView?
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

  var today: String {
    week.days.first { $0.study.isToday }?.date ?? week.startDate
  }

  /// The phases a drawing of the plan counts: studying after an exam comes past its finish, and a
  /// phase the plan holds nothing of has no days.
  var roadPhases: [PlanPhase] {
    phases.filter { $0.kind != .afterExam && $0.state != .leftOut }
  }

  /// What the optional study's offer says it is.
  var extraLabel: String {
    examExtraLabel(hasNotice: hasNotice ?? true, document: examDocument)
  }

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

  /// The phase keeps lessons but its challenge has no room before the plan's date.
  let notPlannedReason: String?
  let challengeLeftOut: Bool
  let chapters: [PlanChapter]
  let checkpoint: Checkpoint?
  let endDate: String?
  let index: Int
  let kind: Kind
  let lessonsDone: Int
  let lessonsTotal: Int
  /// What the learner can do once the phase is done, as a new plan's path names it.
  let milestone: String?
  let mocks: Mocks
  /// Exam phases come without a name; see `PlanPhase.title`.
  let name: String?
  let startDate: String?
  let state: State

  var id: Int { index }

  enum LeftOut: Equatable {
    case challenge
    case lessons(Int)
    case noTimeForChallenge
    case notInPlan
  }

  var leftOut: LeftOut? {
    switch state {
    case .leftOut:
      .notInPlan
    case .unfinished:
      lessonsTotal > lessonsDone ? .lessons(lessonsTotal - lessonsDone) : .challenge
    case .current, .done, .upcoming:
      challengeLeftOut ? .noTimeForChallenge : nil
    }
  }

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
  let nextDate: String?
  let skillId: String?
  /// Skills placement tested out before their lessons were written, named by the row instead of
  /// its course.
  let skills: [String]
  let state: State
  let testedOut: Bool
  let title: String
  let writing: Bool

  var id: String { chapterId ?? skillId ?? title }

  var isSkipped: Bool { !skills.isEmpty || testedOut }

  /// Lessons on the way within the weeks the plan writes ahead: no row of their own.
  var isWritingAhead: Bool { writing && !far && skills.isEmpty }
}

/// The Plan draws a day as Today's week does, from the same study facts.
struct PlanWeekDay: Decodable, Equatable, Identifiable, Sendable {
  let date: String
  let study: StudyWeek.Day

  var id: String { date }
}

/// The day Today will show, which the reveal's Start opens.
struct PlanRevealRead: Decodable, Equatable, Sendable {
  let today: StudyDay
}

enum BaseChoice: String, Codable, Sendable {
  case deep
  case essential
  case quick
  case skip
}

/// What a finished plan's card offers, from the goal map.
struct PlanEnd: Decodable, Equatable, Sendable {
  struct Certificates: Decodable, Equatable, Sendable {
    struct Earned: Decodable, Equatable, Sendable {
      let code: String
      /// Earned without a subscription.
      let locked: Bool
    }

    struct Unclaimed: Decodable, Equatable, Sendable {
      /// Nil for the plan's own certificate.
      let courseLevel: CourseLevel?
    }

    /// Level order, the plan's last, with a level certified in another goal.
    let earned: [Earned]
    /// Finished levels, or the finished plan, without a certificate yet: the learner claims them.
    let unclaimed: [Unclaimed]
  }

  /// Nil for goals that earn none, and until one is finished.
  let certificates: Certificates?
  let next: StudyNext?
}

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

struct LanguageStanding: Decodable, Equatable, Sendable {
  struct Level: Decodable, Equatable, Sendable {
    let label: String
    /// `reading`, `listening`, `speaking` or `writing`.
    let skill: String
  }

  struct PlanLevel: Decodable, Equatable, Sendable {
    let label: String
    /// Nil once the plan's level reaches the goal's.
    let target: String?
  }

  struct Goal: Decodable, Equatable, Sendable {
    let targetLanguage: String
  }

  let goal: Goal
  let level: PlanLevel?
  let levels: [Level]
}

struct LanguageUnitsOverview: Decodable, Equatable, Sendable {
  /// First in the sessions while `pending`.
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

/// Returning to the Plan asks the cheap `getPlanChangedSince` before reading the expensive plan
/// again.
struct PlanRead: Equatable, Sendable {
  var plan: GoalPlan
  let readAt: Date
}

struct GoalSyllabus: Decodable, Equatable, Sendable {
  struct Goal: Decodable, Equatable, Sendable {
    let kind: String
  }

  struct Lessons: Decodable, Equatable, Sendable {
    let done: Int
    let known: Int
    let total: Int
  }

  struct SharedExam: Decodable, Equatable, Sendable {
    let goalId: String
    let name: String
  }

  /// Where the subjects' `questions` come from when the notice gives none.
  struct QuestionsSource: Decodable, Equatable, Sendable {
    let edition: String?
    let url: String
  }

  /// How the learner's course weighs the exam's parts at their institution, which the plan's time
  /// follows.
  struct CourseWeights: Decodable, Equatable, Sendable {
    struct Part: Decodable, Equatable, Sendable {
      let name: String
      let weight: Double
    }

    struct Source: Decodable, Equatable, Sendable {
      let url: String
    }

    let course: String
    let institution: String
    let source: Source?
    let subjects: [Part]
  }

  let courseWeights: CourseWeights?

  let examDocument: ExamDocument
  let fromMaterial: Bool
  let goal: Goal
  let hasNotice: Bool?
  /// `notice` (an exam's own subjects) or `modules`.
  let kind: String
  let lessons: Lessons
  let questionsSource: QuestionsSource?
  /// The learner's other exams whose plans teach some of these subjects with the same lessons.
  let sharedExams: [SharedExam]
  let subjects: [SyllabusSubject]
  let topicCount: Int
  /// The plan says which skills teach which topic, so topics have a status.
  let topicsMapped: Bool
  /// An exam's written parts: their points, trend and past answers.
  let writtenPractice: GoalPlan.WrittenPractice?

  /// Core's `hasSubjectPages`: a language keeps its path; an exam's notice, or more than one
  /// module, has subjects.
  var hasSubjectPages: Bool {
    goal.kind != "language" && (kind == "notice" || subjects.count > 1)
  }

  struct SubjectGroup: Identifiable {
    /// The exam's optional study, after the subjects it tests.
    let extra: Bool
    let name: String?
    let subjects: [SyllabusSubject]

    var id: String { extra ? "extra" : "notice:\(name ?? "")" }
  }

  /// Main's `groupSubjects`: the subjects with no group first, so none reads as part of the group
  /// above it, then the notice's groups in its order or one run of modules, then the optional study.
  var subjectGroups: [SubjectGroup] {
    let modules = kind != "notice"

    func key(_ subject: SyllabusSubject) -> String? {
      subject.isExtra ? nil : modules ? "" : (subject.group ?? "")
    }

    var keys: [String?] = []

    for subject in subjects where !keys.contains(key(subject)) {
      keys.append(key(subject))
    }

    let ungrouped = keys.filter { $0 == "" }
    let named = keys.filter { $0 != nil && $0 != "" }

    return (ungrouped + named + keys.filter { $0 == nil }).map { groupKey in
      let inGroup = subjects.filter { key($0) == groupKey }
      return SubjectGroup(
        extra: groupKey == nil, name: groupKey.flatMap { $0.isEmpty ? nil : $0 }, subjects: inGroup)
    }
  }

  /// What the optional study's group, subject page and lessons say it is.
  var extraLabel: String {
    examExtraLabel(hasNotice: hasNotice ?? true, document: examDocument)
  }

  func sharedExams(of subject: SyllabusSubject) -> [SharedExam] {
    sharedExams.filter { subject.sharedWith.contains($0.goalId) }
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

  struct DisplayWeight: Decodable, Equatable, Sendable {
    enum Basis: String, Decodable, Sendable {
      case assumed
      case stated
    }

    let basis: Basis
    let percent: Int
    let share: Double
  }

  struct Mastery: Decodable, Equatable, Sendable {
    let answered: Int
    let correct: Int
  }

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

  /// The plan's areas it gathers, as plan changes name them.
  let areas: [String]
  let chapters: [Chapter]
  let displayWeight: DisplayWeight?
  /// Set on the exam's optional study, such as its strategy, which the exam doesn't test.
  let extra: Bool?
  /// The notice's group the subject is listed under, if it groups them.
  let group: String?
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
  /// Its share of the exam.
  let share: Double?
  /// Goal ids from the syllabus's `sharedExams`.
  let sharedWith: [String]
  let shortName: String
  let source: String
  let topics: [Topic]
  let topicsKnown: Int?
  let topicsStudied: Int?
  let writtenPart: String?

  var id: String { key }

  var isExtra: Bool { extra == true }

  var lessonShare: Double {
    lessonsTotal > 0 ? Double(lessonsDone + lessonsKnown) / Double(lessonsTotal) : 0
  }
}

extension Array where Element == SyllabusSubject.Chapter {
  var doneChapters: [Element] { filter { $0.state == .done } }
}

struct GoalStanding: Decodable, Equatable, Sendable {
  struct Preparation: Decodable, Equatable, Sendable {
    struct Area: Decodable, Equatable, Identifiable, Sendable {
      let areaId: String
      let preparation: Double
      let title: String
      let weekGain: Double

      var id: String { areaId }
    }

    /// The practice tests preparation counts: `fullReviews` for a learner without mock exams,
    /// whose day calls them "Review".
    struct Parts: Decodable, Equatable, Sendable {
      struct Mocks: Decodable, Equatable, Sendable {
        let kind: String
      }

      let mocks: Mocks
    }

    let areas: [Area]
    let components: Parts
    let value: Double
    let weekGain: Double
  }

  let preparation: Preparation?
}

/// Read and shown in UTC, so the day never moves with the device's zone. Every day shown in words
/// goes through here: a day in another year names it, one in this year doesn't (main's rule).
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

  /// Sunday counted 0, as a schedule's `weekdayMinutes`.
  static func weekday(_ isoDate: String) -> Int? {
    date(isoDate).map { calendar.component(.weekday, from: $0) - 1 }
  }

  static func days(from start: String, to end: String) -> Int {
    guard let start = date(start), let end = date(end) else {
      return 0
    }

    return calendar.dateComponents([.day], from: start, to: end).day ?? 0
  }

  /// A calendar day by its place on the screen (main's `getIsoDateOptions`): a data row's "Nov 20",
  /// a sentence's "November 20", a month, or a weekday's name; with its weekday before it when
  /// asked, and its year in another year than `today`'s, or as `year` says.
  static func format(
    _ isoDate: String, _ role: DateRole = .row, today: String, weekday: Bool = false,
    year: DateYear = .inAnotherYear
  ) -> String {
    guard let date = date(isoDate) else {
      return isoDate
    }

    var style = role.style(weekday: weekday)

    if role != .weekday,
      year == .always || (year == .inAnotherYear && inAnotherYear(isoDate, today: today))
    {
      style = style.year()
    }

    return date.formatted(style)
  }

  /// An instant's day in the learner's zone, by role, with its year when that day isn't in this
  /// year (main's `useFormatMomentDate`).
  static func moment(
    _ moment: Date, _ role: DateRole = .row, weekday: Bool = false,
    year: DateYear = .inAnotherYear, now: Date = .now, timeZone: TimeZone = .current,
    locale: Locale = .autoupdatingCurrent
  ) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let anotherYear =
      calendar.component(.year, from: moment) != calendar.component(.year, from: now)
    var style = role.style(weekday: weekday, timeZone: timeZone, locale: locale)

    if role != .weekday, year == .always || (year == .inAnotherYear && anotherYear) {
      style = style.year()
    }

    return moment.formatted(style)
  }

  /// "Nov 20", with the year when it isn't this year's, as main's plan dates.
  static func text(
    _ isoDate: String, today: String, month: Bool = false, weekday: Bool = false
  ) -> String {
    month
      ? format(isoDate, .rowMonth, today: today, year: .always)
      : format(isoDate, .row, today: today, weekday: weekday)
  }

  /// Main's "long" date: "May 5", with the year when it isn't this year's.
  static func longDay(_ isoDate: String, today: String) -> String {
    format(isoDate, .sentence, today: today)
  }

  /// "Monday, May 5", with the year when it isn't this year's.
  static func weekdayDay(_ isoDate: String, today: String) -> String {
    format(isoDate, .sentence, today: today, weekday: true)
  }

  /// "Nov 3 – 9", with the year when either end isn't in this year.
  static func range(from start: String, to end: String, today: String) -> String {
    guard let first = date(start), let last = date(end), first <= last else {
      return start
    }

    let style = Date.IntervalFormatStyle(timeZone: .gmt).month(.abbreviated).day()
    let anotherYear = inAnotherYear(start, today: today) || inAnotherYear(end, today: today)
    return (first..<last).formatted(anotherYear ? style.year() : style)
  }

  /// The learner's own calendar day, for a screen whose response carries no `today`.
  static func today(_ now: Date = .now, in timeZone: TimeZone = .current) -> String {
    LessonTodayChoices.day(of: now, in: timeZone)
  }

  /// A moment's day in the learner's zone, such as when a mock was finished: `style` without the
  /// year, which it gets when the day isn't in this year (main's `useFormatMomentDay`).
  static func momentDay(
    _ moment: Date, style: Date.FormatStyle = .dateTime.month(.abbreviated).day(),
    now: Date = .now, calendar: Calendar = .current
  ) -> String {
    let thisYear = calendar.component(.year, from: moment) == calendar.component(.year, from: now)
    return moment.formatted(thisYear ? style : style.year())
  }

  /// "Nov", or "November" when `wide`, with the year when it isn't this year's.
  static func monthText(_ isoDate: String, today: String, wide: Bool = false) -> String {
    format(isoDate, wide ? .sentenceMonth : .rowMonth, today: today)
  }

  private static func inAnotherYear(_ isoDate: String, today: String) -> Bool {
    isoDate.prefix(4) != today.prefix(4)
  }

  /// For a day picked in a GMT calendar.
  static func isoDate(_ date: Date) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  static func longText(_ isoDate: String, month: Bool = false) -> String {
    format(isoDate, month ? .sentenceMonth : .sentence, today: isoDate, year: .always)
  }

  /// A time of day in the device's own clock, 12- or 24-hour: "7:30 AM", "19:05".
  static func timeOfDay(minutes: Int, locale: Locale = .current) -> String {
    let time = calendar.date(
      from: DateComponents(year: 2000, month: 1, day: 1, hour: minutes / 60, minute: minutes % 60))

    return (time ?? .distantPast).formatted(
      Date.FormatStyle(date: .omitted, time: .shortened, locale: locale, timeZone: .gmt))
  }

  /// An instant's time of day in the learner's zone, in the device's clock.
  static func timeOfDay(_ moment: Date, in timeZone: TimeZone = .current) -> String {
    moment.formatted(Date.FormatStyle(date: .omitted, time: .shortened, timeZone: timeZone))
  }

  /// "07:30": a time of day as the server reads and writes it, never shown.
  static func wireTime(minutes: Int) -> String {
    String(format: "%02d:%02d", minutes / 60, minutes % 60)
  }

  /// A zone named the system's way, as in "Brasília Time".
  static func zoneName(_ identifier: String) -> String? {
    TimeZone(identifier: identifier)?.localizedName(for: .generic, locale: .current)
  }

  /// "0:52", or "1:02:05" from an hour: a clock of minutes and seconds (main's `formatClock`).
  static func clock(seconds: Int) -> String {
    let seconds = max(seconds, 0)
    return Duration.seconds(seconds).formatted(
      .time(pattern: seconds >= 3600 ? .hourMinuteSecond : .minuteSecond))
  }

  /// A month and its year in parts, for a screen that sets the year apart: "Jul 2027".
  static func monthAndYear(_ date: Date) -> AttributedString {
    date.formatted(DateRole.rowMonth.style(weekday: false).year().attributedStyle)
  }

  /// A clock counting down to `deadline`, which the system keeps current.
  static func countdown(to deadline: Date, from start: Date = .now) -> Text {
    Text(timerInterval: start...max(deadline, start), countsDown: true)
  }

  /// A clock counting up from `start`, which the system keeps current, stopping at `end`.
  static func stopwatch(from start: Date, to end: Date) -> Text {
    Text(timerInterval: start...max(end, start), countsDown: false)
  }

  /// A length to the second, where a rounded one would be wrong, such as an exam's preparation
  /// time: "1 min, 30 sec".
  static func exactDuration(seconds: Int) -> String {
    Duration.seconds(max(seconds, 0)).formatted(
      .units(allowed: [.hours, .minutes, .seconds], width: .abbreviated))
  }

  /// "Monday".
  static func weekdayName(_ isoDate: String) -> String {
    format(isoDate, .weekday, today: isoDate)
  }

  /// A weekday's name from its number, Sunday 0: "Tuesday", or "Tue" when `short` (main's
  /// `formatWeekdayName`). A `label` starts with a capital, as a control's name does in every
  /// language; inside a sentence it's written as the language writes it there.
  static func weekdayName(
    number: Int, short: Bool = false, label: Bool = false,
    locale: Locale = .autoupdatingCurrent
  ) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.locale = locale
    let symbols =
      label
      ? (short ? calendar.shortStandaloneWeekdaySymbols : calendar.standaloneWeekdaySymbols)
      : (short ? calendar.shortWeekdaySymbols : calendar.weekdaySymbols)
    let name = symbols[((number % 7) + 7) % 7]
    return label ? name.labelCased(locale) : name
  }

  /// A span of whole hours in the locale's clock: "6–12 AM" or "06–12".
  static func hourRange(from start: Int, to end: Int, locale: Locale = .autoupdatingCurrent)
    -> String
  {
    let clockFormat = DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: locale) ?? "H"

    guard clockFormat.contains("a") else {
      return String(format: "%02d–%02d", start, end)
    }

    var calendar = Calendar(identifier: .gregorian)
    calendar.locale = locale

    func clock(_ hour: Int) -> (hour: String, period: String) {
      let twelveHour = hour % 12 == 0 ? 12 : hour % 12
      return (
        twelveHour.formatted(.number.locale(locale)),
        hour % 24 < 12 ? calendar.amSymbol : calendar.pmSymbol
      )
    }

    let (from, to) = (clock(start), clock(end))

    return from.period == to.period
      ? "\(from.hour)–\(to.hour) \(to.period)"
      : "\(from.hour) \(from.period)–\(to.hour) \(to.period)"
  }

  /// "M": a weekday's letter, as a week row draws it.
  static func weekdayLetter(_ isoDate: String) -> String {
    date(isoDate)?.formatted(Date.FormatStyle(timeZone: .gmt).weekday(.narrow)) ?? ""
  }

  static func weekday(_ isoDate: String) -> String {
    date(isoDate)?.formatted(Date.FormatStyle(timeZone: .gmt).weekday(.abbreviated)) ?? ""
  }
}

/// Where a date sits on the screen (main's `DateRole`), so a screen asks by role and every screen
/// writes the date one way.
enum DateRole {
  /// A data row or a facts line: "Nov 20".
  case row
  /// A month in a row: "Nov".
  case rowMonth
  /// A date inside a sentence: "November 20".
  case sentence
  /// A month inside a sentence: "November".
  case sentenceMonth
  /// A weekday's name: "Friday".
  case weekday

  /// A calendar day is read in UTC, so it never moves with the device's zone; an instant in the
  /// learner's.
  fileprivate func style(
    weekday: Bool, timeZone: TimeZone = .gmt, locale: Locale = .autoupdatingCurrent
  ) -> Date.FormatStyle {
    let style = Date.FormatStyle(locale: locale, timeZone: timeZone)

    switch self {
    case .row:
      return weekday
        ? style.weekday(.abbreviated).month(.abbreviated).day() : style.month(.abbreviated).day()
    case .rowMonth:
      return style.month(.abbreviated)
    case .sentence:
      return weekday ? style.weekday(.wide).month(.wide).day() : style.month(.wide).day()
    case .sentenceMonth:
      return style.month(.wide)
    case .weekday:
      return style.weekday(.wide)
    }
  }
}

/// Whether a date names its year: by default only in another year than today's (main's rule).
enum DateYear {
  case always
  case inAnotherYear
  case never
}

extension FormatStyle where Self == Date.FormatStyle {
  /// A calendar day read in UTC, so it never shifts a day.
  static var studyDay: Date.FormatStyle {
    var style = Date.FormatStyle(timeZone: .gmt)
    style.calendar.timeZone = .gmt
    return style
  }
}
