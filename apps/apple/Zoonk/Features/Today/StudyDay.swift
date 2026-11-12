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

  struct ExamAccess: Decodable, Equatable, Sendable {
    let includesMockExams: Bool
    let trialEnded: Bool
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

  typealias Minutes = Components.Schemas.StudySessionMinutes

  struct PlusLesson: Decodable, Equatable, Sendable {
    let title: String
  }

  let id: String?
  var blocks: [StudyBlock]
  let brainPower: Int
  let catchUp: CatchUp?
  let current: Bool
  /// Epoch milliseconds.
  let dayEndsAt: Int
  let emptyDay: EmptyDay?
  let examAccess: ExamAccess
  let extraTime: ExtraTime
  let freshStart: FreshStart?
  let fullMeal: FullMeal
  let goalId: String?
  let lessonsComing: Bool
  let lessonsToPrepare: Bool
  /// The learner's calendar day, `YYYY-MM-DD`.
  let localDate: String
  var minutes: Minutes
  let missions: [StudyMission]
  var nextBlockId: String?
  var nextPosition: Int?
  let plusLessons: [PlusLesson]
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

  /// The day as a block's completion says it now stands, before the session is read again: the
  /// block done and the server's next block up.
  func finishing(_ moment: BlockMoment) -> StudyDay {
    guard moment.sessionId == id,
      blocks.filter(\.isFinished).allSatisfy({ old in
        moment.blocks.contains { $0.id == old.id && $0.isFinished }
      })
    else { return self }
    var day = self
    day.blocks = moment.blocks
    day.minutes = moment.minutes
    day.nextBlockId = moment.next?.block.id
    day.nextPosition = moment.next?.block.position
    if moment.sessionCompleted { day.state = .done }

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

  /// Mirrors main's `getFoldedBlocks`: the blocks "+N more" holds while the queue is folded.
  var foldedBlocks: [StudyBlock] {
    Array(queue(next: nextBlock).after.dropFirst(Self.upcomingRows))
  }

  func foldedMinutes(showing blocks: [StudyBlock]) -> Double {
    max(
      0,
      minutes.left - Double(blocks.filter { !$0.isFinished }.reduce(0) { $0 + $1.estimatedMinutes })
    )
  }

  var isStarted: Bool {
    blocks.contains { $0.status != .pending }
  }

  var showsDayProgress: Bool { !blocks.isEmpty && daySegments.count >= 2 }

  /// Core's `getSessionBar`: a skipped block is neither done nor counted.
  var sessionBar: SessionBar {
    SessionBar(
      completed: blocks.filter { $0.status == .completed }.count,
      total: blocks.filter { $0.status != .skipped }.count)
  }

  /// Mirrors main's `DayProgress`: each block core counts, then one part for the time the day holds
  /// for lessons not written yet.
  var daySegments: [DaySegment] {
    var segments = blocks.filter { $0.status != .skipped }.map {
      $0.daySegment(nextPosition: nextPosition)
    }

    if let comingLessons {
      let held = foldedMinutes(showing: blocks)
      if held > 0 { segments.append(.held(minutes: held, comingLessons)) }
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
  case held(minutes: Double, ComingLessons)

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
    case session
    case unknown
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
  let opensInPlayer: Bool
  let oftenTested: Bool
  let planItemId: String?
  let planItemKey: String?
  let position: Int
  let questions: Int
  let refresh: Bool
  let reinforcement: Bool
  let screen: Screen
  var status: Status
  let subject: String?
  let title: String?
  let topics: [String]
  let waitReason: WaitReason?
  let weakest: Bool

  var isFinished: Bool {
    status == .completed || status == .skipped
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

    if mistakesOnly {
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

struct StudyWeek: Decodable, Equatable, Sendable {
  struct Day: Decodable, Equatable, Sendable {
    let date: String
    /// What the learner's plans give the day; 0 on a day without study.
    let goalMinutes: Double
    let hitGoal: Bool
    let isToday: Bool
    let kind: String
    let minutes: Int
    let studied: Bool

    /// Main's `getDayShare`: how much of the day's goal was studied. A day the plan gave no time
    /// that the learner studied anyway fills whole.
    var share: Double {
      if hitGoal {
        return 1
      }

      if goalMinutes == 0 {
        return studied ? 1 : 0
      }

      return min(1, Double(minutes) / goalMinutes)
    }
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
    let refresh: Bool
    let reinforcement: Bool
    let weakest: Bool
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
      refresh: block.refresh, reinforcement: block.reinforcement, weakest: block.weakest)
    kind = block.kind
    lessonId = block.lessonId
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
    try container.encode(planItemKey, forKey: .planItemKey)
    try container.encode(position, forKey: .position)
  }

  private enum CodingKeys: String, CodingKey {
    case areaId, chapterId, checkpoint, flags, kind, lessonId, planItemKey, position
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
