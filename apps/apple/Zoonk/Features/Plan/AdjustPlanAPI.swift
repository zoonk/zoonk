import Foundation

/// A change the learner makes to their plan, in the API's operation shape.
enum PlanEdit: Encodable, Equatable, Sendable {
  case dailyMinutes(Int)
  /// The subjects to focus on: they come first and get more depth.
  case focusAreas([String])
  /// An operation the API offered as it is (a fit offer's), sent back unchanged.
  case operation(JSONValue)
  case baseChoices([(skillId: String, choice: BaseChoice)])
  /// `easier`, `standard` or `harder`.
  case difficultyBias(String)
  /// Studying everything, even after an exam, with no end date.
  case fullCourse(Bool)
  /// `moreExplanation`, `balanced` or `morePractice`.
  case practiceBias(String)
  /// A language plan's activities brought back into its lessons.
  case restoreActivities([String])
  /// A language plan's activities left out of its lessons.
  case skipActivities([String])
  /// A new date, or nil for none: a goal that isn't an exam studies everything at its own pace.
  case targetDate(String?)
  /// Minutes for some weekdays (Sunday 0); 0 makes them rest days.
  case weekdayMinutes(Int, weekdays: [Int])
  /// `weekly`, `biweekly` or `finalWeeks`.
  case writtenCadence(String)

  /// Two edits are the same when they send the same operation.
  static func == (lhs: PlanEdit, rhs: PlanEdit) -> Bool {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .sortedKeys
    return (try? encoder.encode(lhs)) == (try? encoder.encode(rhs))
  }

  private enum CodingKeys: String, CodingKey {
    case activities
    case areas
    case bias
    case cadence
    case choices
    case fullCourse
    case kind
    case minutes
    case targetDate
    case weekdays
  }

  private struct BaseChoiceInput: Encodable {
    let choice: BaseChoice
    let skillId: String
  }

  func encode(to encoder: any Encoder) throws {
    if case .operation(let operation) = self {
      try operation.encode(to: encoder)
      return
    }

    var container = encoder.container(keyedBy: CodingKeys.self)

    switch self {
    case .dailyMinutes(let minutes):
      try container.encode("setDailyMinutes", forKey: .kind)
      try container.encode(minutes, forKey: .minutes)
    case .focusAreas(let areas):
      try container.encode("focusAreas", forKey: .kind)
      try container.encode(areas, forKey: .areas)
    case .baseChoices(let choices):
      try container.encode("setBaseChoices", forKey: .kind)
      try container.encode(
        choices.map { BaseChoiceInput(choice: $0.choice, skillId: $0.skillId) }, forKey: .choices)
    case .difficultyBias(let bias):
      try container.encode("setDifficultyBias", forKey: .kind)
      try container.encode(bias, forKey: .bias)
    case .fullCourse(let fullCourse):
      try container.encode("setFullCourse", forKey: .kind)
      try container.encode(fullCourse, forKey: .fullCourse)
    case .practiceBias(let bias):
      try container.encode("setPracticeBias", forKey: .kind)
      try container.encode(bias, forKey: .bias)
    case .restoreActivities(let activities):
      try container.encode("restoreActivities", forKey: .kind)
      try container.encode(activities, forKey: .activities)
    case .skipActivities(let activities):
      try container.encode("skipActivities", forKey: .kind)
      try container.encode(activities, forKey: .activities)
    case .targetDate(let date):
      try container.encode("setTargetDate", forKey: .kind)

      if let date {
        try container.encode(date, forKey: .targetDate)
      } else {
        try container.encodeNil(forKey: .targetDate)
      }
    case .weekdayMinutes(let minutes, let weekdays):
      try container.encode("setWeekdayMinutes", forKey: .kind)
      try container.encode(minutes, forKey: .minutes)
      try container.encode(weekdays, forKey: .weekdays)
    case .writtenCadence(let cadence):
      try container.encode("setWrittenCadence", forKey: .kind)
      try container.encode(cadence, forKey: .cadence)
    case .operation:
      break
    }
  }
}

/// What a change does to the plan: its end, and the lessons it brings in or leaves out.
struct PlanEffect: Decodable, Equatable, Sendable {
  let endDateAfter: String?
  let endDateBefore: String?
  let lessonsAdded: Int
  let lessonsRemoved: Int
}

/// A change the plan made: what it did, and whether today's session follows it.
struct AppliedPlanChange: Decodable, Equatable, Identifiable, Sendable {
  let canUndo: Bool
  let effect: PlanEffect?
  let id: String
  /// `changed` when today's session follows the change, `unchanged` when it starts tomorrow.
  let todaySession: String?
}

/// What saving a change came to: applied, or not saved because it wouldn't change anything.
enum PlanChangeOutcome: Equatable, Sendable {
  case applied(AppliedPlanChange)
  /// The API refused it (a date out of range, a choice that no longer fits).
  case invalid
  case unchanged
}

/// "Find the time that covers everything": the time a day that covers the goal by its date.
struct PlanTimeToCover: Decodable, Equatable, Sendable {
  let coreMinutes: Int?
  let fittingDate: String?
  let ready: Bool
  let recommendedMinutes: Int?
  let targetDate: String?
}

/// How the app recommends studying the prerequisites, asked for by the learner.
struct PlanBasesAdvice: Decodable, Equatable, Sendable {
  let ready: Bool
  let recommended: BaseChoice?
}

/// A tool's answer: the learner has it, a setup lesson comes first, or examples only.
enum ToolChoice: String, Sendable {
  case have
  case none
  case setup
}
