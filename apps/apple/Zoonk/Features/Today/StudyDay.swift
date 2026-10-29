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

  struct DailyLimit: Decodable, Equatable, Sendable {
    let reached: Bool
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

  struct Minutes: Decodable, Equatable, Sendable {
    let dailyGoal: Double
    let done: Int
    let planned: Int
  }

  struct PlusLesson: Decodable, Equatable, Sendable {
    let title: String
  }

  let id: String?
  let blocks: [StudyBlock]
  let brainPower: Int
  let catchUp: CatchUp?
  let current: Bool
  let dailyLimit: DailyLimit?
  /// Epoch milliseconds.
  let dayEndsAt: Int
  let emptyDay: EmptyDay?
  let examAccess: ExamAccess
  let extraTime: ExtraTime
  let freshStart: FreshStart?
  let fullMeal: FullMeal
  let goalId: String?
  let lessonsComing: Bool
  /// The learner's calendar day, `YYYY-MM-DD`.
  let localDate: String
  let minutes: Minutes
  let missions: [StudyMission]
  let nextBlockId: String?
  let nextPosition: Int?
  let plusLessons: [PlusLesson]
  let status: Status
  let week: StudyWeek

  var nextBlock: StudyBlock? {
    blocks.first { $0.position == nextPosition }
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

  var minutesLeft: Int {
    blocks.filter { !$0.isFinished }.reduce(0) { $0 + $1.estimatedMinutes }
  }

  var isStarted: Bool {
    blocks.contains { $0.status != .pending }
  }

  var meterParts: [MeterParts.Part] {
    blocks.map { block in
      let weight = Double(max(block.estimatedMinutes, 1))

      if block.isFinished {
        return MeterParts.Part(weight: weight, fill: .color(.success))
      }

      if block.position == nextPosition {
        return MeterParts.Part(weight: weight, fill: .current)
      }

      let kind = block.learnKind
      return MeterParts.Part(
        weight: weight, fill: kind == .lesson ? .track : .color(kind.color.opacity(0.35)))
    }
  }

  /// Mirrors main's `getDayState`.
  var state: DayState {
    let empty = blocks.isEmpty
    let limitReached = dailyLimit?.reached == true
    let studyDay = empty && !limitReached && minutes.dailyGoal > 0
    let done = !empty && nextPosition == nil

    if studyDay && emptyDay == .lessonsComing {
      return .waiting
    }

    if nextBlock != nil && !limitReached {
      return .underway
    }

    if limitReached && !done {
      return .limit
    }

    if studyDay {
      return .ahead
    }

    return empty && !limitReached && minutes.dailyGoal == 0 ? .rest : .done
  }
}

enum DayState: Equatable, Sendable {
  case ahead
  case done
  case limit
  case rest
  case underway
  case waiting
}

struct StudyBlock: Decodable, Equatable, Sendable {
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

  /// Where a tap opens the block, by core's rule. `unknown`: a lesson block whose lesson the read
  /// didn't check, so its readiness is asked first.
  enum Screen: String, Decodable, Sendable {
    case challenge
    case essay
    case lesson
    case session
    case unknown
  }

  struct Capsule: Decodable, Equatable, Sendable {
    let questions: Int
    let title: String?
  }

  struct Checkpoint: Codable, Equatable, Sendable {
    struct MockIdentity: Codable, Equatable, Sendable {
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
  let areaId: String?
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
  let oftenTested: Bool
  let planItemId: String?
  let planItemKey: String?
  let position: Int
  let questions: Int
  let refresh: Bool
  let reinforcement: Bool
  let screen: Screen
  let status: Status
  let subject: String?
  let title: String?
  let waitReason: WaitReason?
  let weakest: Bool

  var isFinished: Bool {
    status == .completed || status == .skipped
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

  /// Mirrors main's `isQuestionBlock`.
  var isQuestionBlock: Bool {
    kind != .learn && screen == .session
  }
}

struct StudyWeek: Decodable, Equatable, Sendable {
  struct Day: Decodable, Equatable, Sendable {
    let date: String
    let hitGoal: Bool
    let isToday: Bool
    let kind: String
    let studied: Bool
  }

  struct Time: Decodable, Equatable, Sendable {
    let studiedMinutes: Int
    let targetMinutes: Double
  }

  let days: [Day]
  let nextStudyDate: String?
  let time: Time

  /// Main's week counts any study, and a rest day the learner studied anyway among its days.
  var daysStudied: Int { days.filter(\.studied).count }
  var studyDayCount: Int { days.filter { $0.kind == "study" || $0.studied }.count }
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
