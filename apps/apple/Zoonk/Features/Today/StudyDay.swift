import SwiftUI

struct StudyDay: Decodable, Equatable, Sendable {
  enum Status: String, Decodable, Sendable {
    case active
    case completed
    case planned
    case unstarted
  }

  enum EmptyDay: String, Decodable, Sendable {
    case lessonsComing
    case lessonsToPrepare
    case nothingNew
  }

  enum FreshStart: String, Decodable, Sendable {
    case newPhase
    case newWeek
    case welcomeBack
  }

  struct CatchUp: Decodable, Equatable, Sendable {
    struct Later: Decodable, Equatable, Sendable {
      let lessons: Int
      let minutes: Int
      let offered: Bool
    }

    let later: Later
    let lessonsLeft: Int
    let positions: [Int]
  }

  struct ExtraTime: Decodable, Equatable, Sendable {
    struct Lesson: Decodable, Equatable, Sendable {
      let minutes: Int
      let title: String
    }

    let available: Bool
    let lessons: [Lesson]
    let minutes: Int
  }

  struct FullMeal: Decodable, Equatable, Sendable {
    let bonus: Int
    let earned: Bool
  }

  /// The plan topic whose lessons the day keeps time for before they're written.
  struct LessonPlaceholder: Decodable, Equatable, Sendable {
    let title: String
  }

  typealias Minutes = Components.Schemas.StudySessionMinutes

  let id: String?
  var blocks: [StudyBlock]
  let brainPower: Int
  let catchUp: CatchUp?
  let current: Bool
  /// Epoch milliseconds.
  let dayEndsAt: Int
  let emptyDay: EmptyDay?
  let extraTime: ExtraTime
  let freshStart: FreshStart?
  let fullMeal: FullMeal
  let goalId: String?
  let lessonPlaceholder: LessonPlaceholder?
  let lessonsComing: Bool
  let lessonsToPrepare: Bool
  /// The learner's calendar day, `YYYY-MM-DD`.
  let localDate: String
  var minutes: Minutes
  let missions: [StudyMission]
  var nextBlockId: String?
  var nextPosition: Int?
  var state: DayState
  let status: Status
  let week: StudyWeek

  var nextBlock: StudyBlock? {
    blocks.first { $0.position == nextPosition }
  }

  /// Main's `waitsForStart`: a question block that hasn't begun opens on the session and waits for
  /// Start there, so the learner reads what it is before it starts. An unopened day's session shows
  /// only its next step.
  func waitsForStart(_ block: StudyBlock) -> Bool {
    block.screen == .session && block.kind != .learn && block.status != .active
      && (block.id != nil || block.position == nextPosition)
  }

  /// Mirrors main's `ComingLessonsRow`: the time a day holds for lessons not written yet, which
  /// the learner asks for while nobody is outlining them.
  var comingLessons: ComingLessons? {
    if lessonsToPrepare {
      return .toPrepare
    }

    return lessonsComing ? .beingWritten : nil
  }

  /// Main's `useComingLessons`: the held time is named by the plan topic it's for.
  var comingLessonsTitle: String {
    lessonPlaceholder?.title
      ?? String(
        localized: "Your next lessons", table: "Today",
        comment: "Holds the place of the day's lessons that aren't written yet")
  }

  /// The day as a block's completion says it now stands, before the session is read again: the
  /// block done and the server's next block up.
  func finishing(_ moment: BlockMoment) -> StudyDay {
    guard moment.sessionId == id,
      blocks.filter(\.isFinished).allSatisfy({ old in
        moment.blocks.contains { $0.id == old.id && $0.isFinished }
      })
    else { return self }
    var day = self
    // The completion lists blocks by position; Today keeps the server's play order.
    let fresh = moment.blocks
    day.blocks =
      blocks.compactMap { old in fresh.first { $0.id == old.id } }
      + fresh.filter { new in !blocks.contains { $0.id == new.id } }
    day.minutes = moment.minutes
    day.nextBlockId = moment.next?.block.id
    day.nextPosition = moment.next?.block.position
    if moment.dayProgress.lead == .complete { day.state = .done }

    return day
  }

  /// Mirrors main's `splitTodayQueue`: the blocks still to do keep their order around the next one.
  func queue(next: StudyBlock?) -> (before: [StudyBlock], after: [StudyBlock]) {
    guard let index = blocks.firstIndex(where: { $0.position == next?.position }) else {
      return (before: [], after: blocks.filter { !$0.isFinished })
    }

    return (
      before: blocks[..<index].filter { !$0.isFinished },
      after: blocks[(index + 1)...].filter { !$0.isFinished }
    )
  }

  /// Rows the queue shows after its next block before "+N more".
  static let upcomingRows = 4

  /// Mirrors main's `getFoldedRows`: how many of the `count` rows after the next block show while
  /// folded. A single row past the first few shows: folding it would cost a tap to save one row.
  static func shownUpcomingRows(_ count: Int) -> Int {
    count - upcomingRows > 1 ? upcomingRows : count
  }

  /// The day's time left past the `shown` rows, plus the extras among the rows it hides: core's
  /// time left counts only day blocks.
  func foldedMinutes(showing shown: [StudyBlock]) -> Double {
    let shownDay = shown.filter { !$0.isFinished && !$0.extra }
    let hiddenExtras = blocks.filter { $0.extra && !$0.isFinished && !shown.contains($0) }

    return max(0, minutes.left - Double(shownDay.reduce(0) { $0 + $1.estimatedMinutes }))
      + Double(hiddenExtras.reduce(0) { $0 + $1.estimatedMinutes })
  }

  /// Main's `SessionQueue`: rows name their subject only when the day's blocks span more than one.
  var showsSubjects: Bool {
    Set(blocks.compactMap { $0.subject ?? $0.subjectExtra?.rawValue }).count > 1
  }

  var isStarted: Bool {
    blocks.contains { $0.status != .pending }
  }

  var showsDayProgress: Bool { !blocks.isEmpty && daySegments.count >= 2 }

  /// Core's `getSessionBar`: day blocks only, and a skipped one is neither done nor counted.
  var sessionBar: SessionBar {
    let counted = blocks.filter(\.countsTowardDay)
    return SessionBar(
      completed: counted.filter { $0.status == .completed }.count, total: counted.count)
  }

  /// Mirrors main's `DayProgress`: each block core counts, then one part for the time the day holds
  /// for lessons not written yet.
  var daySegments: [DaySegment] {
    var segments = blocks.filter(\.countsTowardDay).map {
      $0.daySegment(nextPosition: nextPosition)
    }

    if let comingLessons {
      let held = foldedMinutes(showing: blocks)
      if held > 0 {
        segments.append(.held(minutes: held, comingLessons, title: comingLessonsTitle))
      }
    }

    return segments
  }
}

/// One equal part of today's meter, and what its popover on Today says.
enum DaySegment {
  enum State {
    case ahead
    case current
    case done
  }

  case block(StudyBlock, State)
  case held(minutes: Double, ComingLessons, title: String)

  /// How the part is drawn: done, next up, or waiting in its kind's color.
  var mark: DaySegments.Segment {
    switch self {
    case .block(_, .done): .done
    case .block(_, .current): .current
    case .block(let block, .ahead):
      block.learnKind == .lesson ? .ahead : .kind(block.learnKind.color)
    case .held: .ahead
    }
  }
}

enum ComingLessons {
  case beingWritten
  case toPrepare

  /// Main's `useComingLessons`: once the wait for them runs out, the learner asks for them.
  func asked(writingStalled: Bool) -> ComingLessons {
    writingStalled ? .toPrepare : self
  }

  /// What the held time's row and its part of the meter say about its lessons.
  var note: String {
    switch self {
    case .toPrepare:
      String(
        localized: "Not ready yet", table: "Today",
        comment: "The day's next lessons, which nobody has asked for yet")
    case .beingWritten:
      String(localized: "Getting ready…", table: "Today")
    }
  }
}

/// Core decides where the day stands.
enum DayState: String, Decodable, Sendable {
  case ahead
  case done
  /// Its lessons wait for the learner to ask for them.
  case prepare
  case rest
  case underway
  case waiting
}

struct StudyBlock: Decodable, Hashable, Sendable {
  enum Kind: String, Codable, Sendable {
    case checkpoint
    case learn
    case practice
    case produce
    case review
  }

  enum Status: String, Decodable, Sendable {
    case active
    case completed
    case pending
    case skipped
  }

  enum WaitReason: String, Decodable, Sendable {
    case challenge
    case lessons
  }

  /// Where a tap on the block opens it, as core decides.
  enum Screen: String, Decodable, Sendable {
    case challenge
    case essay
    case lesson
    case mistakesPractice
    case pattern
    case session
    case unknown
  }

  /// Why a lesson the learner already had is back in the day.
  enum Returning: String, Codable, Sendable {
    /// The same lesson again, for a skill they keep missing.
    case again
    /// A second lesson that explains the skill another way.
    case anotherWay
    /// A lesson written for a skill they keep missing that had none.
    case missed
  }

  /// Whether the exam that leaves the optional study out has an official guide.
  enum SubjectExtra: String, Decodable, Hashable, Sendable {
    case notice
    case optional
  }

  struct Capsule: Decodable, Hashable, Sendable {
    let questions: Int
    let title: String?
  }

  struct Checkpoint: Codable, Hashable, Sendable {
    struct MockIdentity: Codable, Hashable, Sendable {
      let day: Int?
      let fullLength: Bool
    }

    let kind: String
    let mock: Bool
    let mockIdentity: MockIdentity?
    let phase: Int?
    let rematch: Bool

    var isWeekly: Bool { kind == "weekly" }
  }

  /// The saved block's id; nil on a day not opened yet.
  let id: String?
  let answered: Int
  let areaId: String?
  let areas: [String]
  let brainPower: Int
  let canDo: String?
  let canTestOut: Bool
  let capsules: [Capsule]
  let chapterId: String?
  let checkpoint: Checkpoint?
  let estimatedMinutes: Int
  let extra: Bool
  let fullReview: Bool
  let kind: Kind
  let lessonId: String?
  let mistakesOnly: Bool
  let mockPreparationReview: Bool?
  let opensInPlayer: Bool
  let oftenTested: Bool
  /// The language pattern a pattern block practices.
  let patternId: String?
  let planItemId: String?
  let planItemKey: String?
  let position: Int
  let preparing: Bool
  let questions: Int
  let refresh: Bool
  let reinforcement: Bool
  let returning: Returning?
  let screen: Screen
  var status: Status
  let subject: String?
  /// Set on a lesson of the exam's optional study, such as its strategy, which the row names
  /// instead of a subject.
  let subjectExtra: SubjectExtra?
  let title: String?
  let topics: [String]
  let waitReason: WaitReason?
  let weakest: Bool
  let hasWritingDraft: Bool?
  let writingAvailability: WritingAvailability?
  /// A drill or a whole answer, known before any question is assigned.
  let writingUnit: WritingPrompt.Unit?
  let writingTask: WritingTaskName?

  var isFinished: Bool {
    status == .completed || status == .skipped
  }

  /// Core's `isDayBlock`, not skipped: what the day's count, meter and time left are made of. Extra
  /// work never lowers them.
  var countsTowardDay: Bool {
    !extra && status != .skipped
  }

  /// The lesson a finished row opens again, outside the session. A skipped lesson comes back in
  /// the plan, and finished review, practice or challenge work was made for its day.
  var lessonToReopen: String? {
    status == .completed && kind == .learn ? lessonId : nil
  }

  /// Main's `getDayMeterParts` for one counted block: done, next up, or ahead.
  func daySegment(nextPosition: Int?) -> DaySegment {
    if status == .completed {
      return .block(self, .done)
    }

    return .block(self, position == nextPosition ? .current : .ahead)
  }

  /// Mirrors main's `getBlockKind`.
  var learnKind: LearnKind {
    if checkpoint?.mock == true {
      return .mock
    }

    if checkpoint != nil {
      return .challenge
    }

    if mistakesOnly || screen == .mistakesPractice || screen == .pattern {
      return .mistakes
    }

    switch kind {
    case .checkpoint: return .challenge
    case .learn: return .lesson
    case .practice: return .practice
    case .produce: return .essay
    case .review: return .review
    }
  }
}

enum WritingAvailability: Decodable, Hashable, Sendable {
  case available
  case `continue`
  case tomorrow(returnsOn: String)
  /// The question depends on an exam choice the learner hasn't made, named as the notice names it.
  case needsChoice(choiceGroups: [String])

  private enum CodingKeys: String, CodingKey { case choiceGroups, returnsOn, status }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    switch try container.decode(String.self, forKey: .status) {
    case "continue": self = .continue
    case "tomorrow":
      self = .tomorrow(returnsOn: try container.decode(String.self, forKey: .returnsOn))
    case "needsChoice":
      self = .needsChoice(choiceGroups: try container.decode([String].self, forKey: .choiceGroups))
    default: self = .available
    }
  }

  var returnsOn: String? {
    if case .tomorrow(let day) = self { day } else { nil }
  }

  var choiceGroups: [String]? {
    if case .needsChoice(let groups) = self { groups } else { nil }
  }
}

struct StudyWeek: Decodable, Equatable, Sendable {
  /// Core's `StudyWeekDay`, which Today's week and the Plan's draw with `WeekDayRing`.
  struct Day: Decodable, Equatable, Sendable {
    /// Day blocks done and not skipped; extra work isn't counted.
    let completed: Int
    let date: String
    /// What the learner's plans give the day; 0 on a day without study.
    let goalMinutes: Double
    /// The day's list was finished once, or a day without one was studied.
    let hitGoal: Bool
    let isToday: Bool
    let kind: String
    /// Time studied, extras included.
    let minutes: Int
    let studied: Bool
    let total: Int
  }

  let days: [Day]
  let nextStudyDate: String?
}

/// Core's `DayBlockRef`: opening the day with it resolves only to that same work.
struct DayBlockRef: Encodable, Equatable, Sendable {
  struct Flags: Encodable, Equatable, Sendable {
    let extra: Bool
    let fullReview: Bool
    let mistakesOnly: Bool
    let mistakesPractice: Bool
    let mockPreparationReview: Bool?
    let refresh: Bool
    let reinforcement: Bool
    let returning: StudyBlock.Returning?
    let weakest: Bool

    /// Core leaves out a remedial flag a block doesn't have.
    func encode(to encoder: any Encoder) throws {
      var container = encoder.container(keyedBy: CodingKeys.self)
      try container.encode(extra, forKey: .extra)
      try container.encode(fullReview, forKey: .fullReview)
      try container.encode(mistakesOnly, forKey: .mistakesOnly)
      if mistakesPractice { try container.encode(true, forKey: .mistakesPractice) }
      try container.encodeIfPresent(mockPreparationReview, forKey: .mockPreparationReview)
      try container.encode(refresh, forKey: .refresh)
      try container.encode(reinforcement, forKey: .reinforcement)
      try container.encodeIfPresent(returning, forKey: .returning)
      try container.encode(weakest, forKey: .weakest)
    }

    private enum CodingKeys: String, CodingKey {
      case extra, fullReview, mistakesOnly, mistakesPractice, mockPreparationReview, refresh
      case reinforcement, returning, weakest
    }
  }

  /// A mock carries its identity; any other checkpoint has none at all, and its phase is null when
  /// it has none.
  struct Checkpoint: Encodable, Equatable, Sendable {
    let kind: String
    let mock: Bool
    let mockIdentity: StudyBlock.Checkpoint.MockIdentity?
    let phase: Int?
    let rematch: Bool

    func encode(to encoder: any Encoder) throws {
      var container = encoder.container(keyedBy: CodingKeys.self)
      try container.encode(kind, forKey: .kind)
      try container.encode(mock, forKey: .mock)
      try container.encodeIfPresent(mockIdentity, forKey: .mockIdentity)
      try container.encode(phase, forKey: .phase)
      try container.encode(rematch, forKey: .rematch)
    }

    private enum CodingKeys: String, CodingKey {
      case kind, mock, mockIdentity, phase, rematch
    }
  }

  let areaId: String?
  let chapterId: String?
  let checkpoint: Checkpoint?
  let flags: Flags
  let kind: StudyBlock.Kind
  let lessonId: String?
  let patternId: String?
  let planItemKey: String?
  let position: Int

  init(_ block: StudyBlock) {
    areaId = block.areaId
    chapterId = block.chapterId
    checkpoint = block.checkpoint.map {
      Checkpoint(
        kind: $0.kind, mock: $0.mock, mockIdentity: $0.mock ? $0.mockIdentity : nil,
        phase: $0.phase, rematch: $0.rematch)
    }
    flags = Flags(
      extra: block.extra, fullReview: block.fullReview, mistakesOnly: block.mistakesOnly,
      mistakesPractice: block.screen == .mistakesPractice,
      mockPreparationReview: block.mockPreparationReview, refresh: block.refresh,
      reinforcement: block.reinforcement, returning: block.returning, weakest: block.weakest)
    kind = block.kind
    lessonId = block.lessonId
    patternId = block.patternId
    planItemKey = block.planItemKey
    position = block.position
  }

  // `nil` optionals are sent as `null`, as core's schema reads them.
  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(areaId, forKey: .areaId)
    try container.encode(chapterId, forKey: .chapterId)
    try container.encode(checkpoint, forKey: .checkpoint)
    try container.encode(flags, forKey: .flags)
    try container.encode(kind, forKey: .kind)
    try container.encode(lessonId, forKey: .lessonId)
    try container.encodeIfPresent(patternId, forKey: .patternId)
    try container.encode(planItemKey, forKey: .planItemKey)
    try container.encode(position, forKey: .position)
  }

  private enum CodingKeys: String, CodingKey {
    case areaId, chapterId, checkpoint, flags, kind, lessonId, patternId, planItemKey, position
  }
}

/// Through JSON, so features decode only the fields they draw from the API's large generated types.
enum StudyJSON {
  static func recode<Value: Decodable>(_ value: some Encodable, as type: Value.Type = Value.self)
    throws -> Value
  {
    try JSONDecoder().decode(type, from: JSONEncoder().encode(value))
  }
}
