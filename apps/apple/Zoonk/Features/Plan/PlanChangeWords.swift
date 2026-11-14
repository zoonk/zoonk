import Foundation

/// An operation of a plan change, read for the words that name it. Every field but `kind` belongs
/// to some kinds only.
struct PlanChangeOperation: Decodable, Equatable, Sendable {
  struct Part: Decodable, Equatable, Sendable {
    let area: String
    let name: String
  }

  struct Skill: Decodable, Equatable, Sendable {
    let name: String
  }

  struct BaseChoiceEntry: Decodable, Equatable, Sendable {
    let choice: BaseChoice
  }

  let kind: String
  var activities: [String]?
  var aim: String?
  var areas: [String]?
  /// `easier`, `standard`, `harder`, `moreExplanation`, `balanced` or `morePractice`.
  var bias: String?
  var choices: [BaseChoiceEntry]?
  var estimated: Bool?
  var fullCourse: Bool?
  var group: String?
  var minutes: Int?
  var parts: [Part]?
  var skills: [Skill]?
  /// `pastBasics` or `basics`.
  var start: String?
  var startDate: String?
  var subjects: [String]?
  var targetDate: String?
  var to: String?
  var weekdays: [Int]?
}

/// Main's `useChangeWords`: a proposed change asks a question in the learner's words, once applied
/// it says what it did. What it moves is never said here: that's `PlanEffectDiff`.
enum PlanChangeWords {
  /// What a card shows: its title, and at most one sentence under it.
  struct Words: Equatable {
    let title: String
    let why: String?
  }

  static func words(
    kind: String, source: String, status: String, operations: [PlanChangeOperation],
    reason: String?, effect: PlanEffect?, dateKind: GoalDateKind
  ) -> Words {
    if let system = systemSentence(kind: kind, effect: effect) {
      return Words(title: system, why: nil)
    }

    if ["proposed", "declined", "replaced"].contains(status) {
      return asked(
        source: source, operations: operations, reason: reason, effect: effect, dateKind: dateKind)
    }

    return Words(
      title: operations.isEmpty
        ? String(localized: "Your plan changed.", table: "Plan", comment: "A plan change, applied")
        : statements(operations, dateKind: dateKind),
      why: nil)
  }

  /// Each operation's applied statement, one after the other.
  static func statements(_ operations: [PlanChangeOperation], dateKind: GoalDateKind) -> String {
    operations.map { statement($0, dateKind: dateKind) }.joinedSentences()
  }

  /// The line under a change once it's answered.
  static func appliedLine(todaySession: String?) -> String {
    switch todaySession {
    case "changed":
      String(
        localized: "Done. Today's lessons changed too.", table: "Plan",
        comment: "A plan change was applied, and today's lessons follow it")
    case "unchanged":
      String(
        localized: "Done. It starts on your next study day.", table: "Plan",
        comment: "A plan change was applied from the next study day")
    default:
      String(localized: "Done.", table: "Plan", comment: "A plan change was applied")
    }
  }

  private static func asked(
    source: String, operations: [PlanChangeOperation], reason: String?, effect: PlanEffect?,
    dateKind: GoalDateKind
  ) -> Words {
    if source == "phaseDates" {
      let phaseDates = phaseDatesQuestion(effect)
      return Words(title: phaseDates.title, why: reason ?? phaseDates.why)
    }

    if let only = operations.first, operations.count == 1,
      let own = question(only, dateKind: dateKind)
    {
      return Words(title: own, why: reason)
    }

    return Words(
      title: String(
        localized: "Change your plan?", table: "Plan",
        comment: "Title of a plan change that makes several changes at once"),
      why: reason ?? (operations.isEmpty ? nil : statements(operations, dateKind: dateKind)))
  }

  /// A change the plan made by itself says why in one sentence.
  private static func systemSentence(kind: String, effect: PlanEffect?) -> String? {
    switch kind {
    case "missedDays":
      String(
        localized: "Your plan moved to fit the days you missed.", table: "Plan",
        comment: "A plan change the plan made after missed study days")
    case "estimateUpdated":
      effect.map { $0.lessonsAdded != $0.lessonsRemoved } == true
        ? String(
          localized: "Your plan changed to match the time your lessons take.", table: "Plan",
          comment: "A plan change the plan made because lessons take more or less time than planned"
        )
        : nil
    case "coverageChanged":
      effect?.fromPlacement == true
        ? String(
          localized: "Your test answers changed your plan.", table: "Plan",
          comment: "A plan change the learner's test answers made")
        : String(localized: "Your plan changed.", table: "Plan", comment: "A plan change, applied")
    default:
      nil
    }
  }

  // MARK: Questions

  /// Nil when the operation has no question of its own.
  static func question(_ operation: PlanChangeOperation, dateKind: GoalDateKind) -> String? {
    areaQuestion(operation) ?? timeQuestion(operation) ?? dateQuestion(operation, dateKind)
      ?? lessonsQuestion(operation)
  }

  private static func subjects(_ operation: PlanChangeOperation) -> String {
    let parts = operation.kind == "focusAreas" ? operation.parts ?? [] : []

    return (operation.areas ?? []).map { area in
      parts.first { $0.area == area }?.name ?? area
    }
    .formatted(.list(type: .and))
  }

  private static func areaQuestion(_ operation: PlanChangeOperation) -> String? {
    let subjects = subjects(operation)

    switch operation.kind {
    case "addSkills":
      let topics = planTopicList((operation.skills ?? []).map(\.name))
      return String(
        localized: "Add \(topics) to your plan?", table: "Plan",
        comment: "Asks to add topics to the plan; the argument lists them")
    case "focusAreas":
      return (operation.areas ?? []).isEmpty
        ? String(
          localized: "Remove your focus?", table: "Plan",
          comment: "Asks to stop giving any subject more time")
        : String(
          localized: "Focus on \(subjects)?", table: "Plan",
          comment: "Asks to give these subjects more time")
    case "reduceAreas":
      return String(
        localized: "Less time for \(subjects)?", table: "Plan",
        comment: "Asks to give these subjects less time")
    case "skipAreas":
      return String(
        localized: "Take \(subjects) out of your plan?", table: "Plan",
        comment: "Asks to leave these subjects out of the plan")
    case "restoreAreas":
      return String(
        localized: "Add \(subjects) back to your plan?", table: "Plan",
        comment: "Asks to bring subjects the learner took out back into the plan")
    case "setAreaStart":
      return operation.start == "pastBasics"
        ? String(
          localized: "Skip the basics of \(subjects)?", table: "Plan",
          comment: "Asks to start these subjects past their basics")
        : String(
          localized: "Start \(subjects) from the basics?", table: "Plan",
          comment: "Asks to start these subjects from their basics")
    default:
      return nil
    }
  }

  private static func days(_ operation: PlanChangeOperation) -> String {
    (operation.weekdays ?? []).map(planWeekdayName).formatted(.list(type: .and))
  }

  private static func timeQuestion(_ operation: PlanChangeOperation) -> String? {
    let time = planDurationText(minutes: Double(operation.minutes ?? 0))
    let today = PlanDate.today()

    switch operation.kind {
    case "setDailyMinutes":
      return String(
        localized: "Study \(time) a day?", table: "Plan",
        comment: "Asks to change the time a day; the argument is a duration like \"30 min\"")
    case "setWeekdayMinutes":
      let days = days(operation)

      guard operation.minutes == 0 else {
        return String(
          localized: "Study \(time) on \(days)?", table: "Plan",
          comment:
            "Asks to change some weekdays' time; the first argument is a duration, the second weekdays"
        )
      }

      return (operation.weekdays ?? []).count == 1
        ? String(
          localized: "Make \(days) a rest day?", table: "Plan",
          comment: "Asks to make one weekday a rest day")
        : String(
          localized: "Make \(days) rest days?", table: "Plan",
          comment: "Asks to make several weekdays rest days")
    case "addLightWeek":
      let date = PlanDate.longDay(operation.startDate ?? today, today: today)
      return String(
        localized: "Take a lighter week from \(date), at half the time?", table: "Plan",
        comment: "Asks to study half the time for a week; the argument is a day like \"May 5\"")
    case "moveWeeklyEvent":
      let date = PlanDate.longDay(operation.to ?? today, today: today)
      return String(
        localized: "Move this week's challenge to \(date)?", table: "Plan",
        comment: "Asks to move the week's challenge; the argument is a day like \"May 5\"")
    default:
      return nil
    }
  }

  private static func dateQuestion(_ operation: PlanChangeOperation, _ dateKind: GoalDateKind)
    -> String?
  {
    let today = PlanDate.today()

    switch operation.kind {
    case "setTargetDate", "setNoticeDate":
      guard let target = operation.targetDate else {
        return String(
          localized: "Study without an end date?", table: "Plan",
          comment: "Asks to drop the goal's date")
      }

      let date = PlanDate.longDay(target, today: today)

      switch dateKind {
      case .exam:
        return String(
          localized: "Move your exam date to \(date)?", table: "Plan",
          comment: "Asks to move the exam's date; the argument is a day like \"May 5\"")
      case .goal:
        return String(
          localized: "Move your end date to \(date)?", table: "Plan",
          comment: "Asks to move the goal's end date; the argument is a day like \"May 5\"")
      case .unknown:
        return String(
          localized: "Move your date to \(date)?", table: "Plan",
          comment: "Asks to move the goal's date; the argument is a day like \"May 5\"")
      }
    case "setFullCourse":
      return operation.fullCourse == true
        ? String(
          localized: "Keep studying after the exam?", table: "Plan",
          comment: "Asks to keep studying what's left after the exam")
        : String(
          localized: "End your plan at the exam?", table: "Plan",
          comment: "Asks to stop the plan at the exam")
    default:
      return nil
    }
  }

  private static func lessonsQuestion(_ operation: PlanChangeOperation) -> String? {
    switch operation.kind {
    case "skipActivities":
      let activities = (operation.activities ?? []).map(planActivityName)
        .formatted(.list(type: .and))
      return String(
        localized: "Take \(activities) out of your lessons?", table: "Plan",
        comment: "Asks to leave practice activities out of the lessons, such as Listening")
    case "restoreActivities":
      let activities = (operation.activities ?? []).map(planActivityName)
        .formatted(.list(type: .and))
      return String(
        localized: "Bring \(activities) back to your lessons?", table: "Plan",
        comment: "Asks to bring practice activities back to the lessons, such as Listening")
    case "setPracticeBias":
      return operation.bias == "morePractice"
        ? String(localized: "More practice?", table: "Plan", comment: "Asks for more practice")
        : String(
          localized: "More explanation?", table: "Plan", comment: "Asks for more explanation")
    case "setDifficultyBias":
      switch operation.bias {
      case "harder":
        return String(
          localized: "Harder lessons?", table: "Plan", comment: "Asks for harder lessons")
      case "easier":
        return String(
          localized: "Easier lessons?", table: "Plan", comment: "Asks for easier lessons")
      default:
        return String(
          localized: "Back to the usual difficulty?", table: "Plan",
          comment: "Asks to go back to lessons at the usual difficulty")
      }
    case "setBaseChoices":
      return String(
        localized: "Change your prerequisites?", table: "Plan",
        comment: "Asks to change how much of the prerequisites the plan studies")
    case "setAim":
      return String(
        localized: "Study up to \(operation.aim ?? "")?", table: "Plan",
        comment:
          "Asks to change the level a language course goes up to; the argument is a level like B1"
      )
    case "fitLessons":
      return String(
        localized: "Add the lessons your time fits?", table: "Plan",
        comment: "Asks to bring in the lessons the learner's time fits")
    default:
      return nil
    }
  }

  /// One thing moves: which, and why in the learner's terms.
  private static func phaseDatesQuestion(_ effect: PlanEffect?) -> Words {
    let moves = effect?.phaseEnds ?? []
    let late = moves.filter { $0.lessonsFirst == true }
    let resting = moves.filter { $0.restDay == true }

    if late.count > 1 {
      return Words(
        title: String(
          localized: "Move your phase dates later?", table: "Plan",
          comment: "Asks to move several phases' ends later"),
        why: String(
          localized: "That gives you time to finish each phase's lessons.", table: "Plan",
          comment: "Why moving several phases' ends later"))
    }

    if let first = late.first {
      let days = PlanDate.days(from: first.before, to: first.after)

      return Words(
        title: String(
          localized: "Move the end of \(first.name) \(days) days later?", table: "Plan",
          comment: "Asks to move a phase's end later; the first argument is the phase's name"),
        why: String(
          localized: "That gives you time to finish its lessons.", table: "Plan",
          comment: "Why moving a phase's end later"))
    }

    if resting.count > 1 {
      return Words(
        title: String(
          localized: "Move your phase dates off rest days?", table: "Plan",
          comment: "Asks to move phases' ends off days the learner doesn't study"),
        why: nil)
    }

    if let rest = resting.first {
      let day = PlanDate.weekdayName(rest.before)

      return Words(
        title: String(
          localized: "Move the end of \(rest.name) off \(day)?", table: "Plan",
          comment: "Asks to move a phase's end off a weekday; the second argument is a weekday"),
        why: String(
          localized: "\(day.labelCased()) is a day you don't study.", table: "Plan",
          comment: "Why moving a phase's end; the argument is a weekday"))
    }

    return Words(
      title: String(
        localized: "Move your phase dates?", table: "Plan", comment: "Asks to move the phases' ends"
      ),
      why: nil)
  }

  // MARK: Applied statements

  static func statement(_ operation: PlanChangeOperation, dateKind: GoalDateKind) -> String {
    let subjects = subjects(operation)
    let count = (operation.areas ?? []).count
    let time = planDurationText(minutes: Double(operation.minutes ?? 0))
    let today = PlanDate.today()

    switch operation.kind {
    case "addSkills":
      return addedStatement(
        planTopicList((operation.skills ?? []).map(\.name)), count: (operation.skills ?? []).count)
    case "focusAreas":
      return count > 0
        ? String(
          localized: "Your focus: \(subjects).", table: "Plan",
          comment: "Says the plan gives these subjects more time")
        : String(
          localized: "Your plan has no focus.", table: "Plan",
          comment: "Says the plan no longer gives any subject more time")
    case "reduceAreas":
      return String(
        localized: "Less time for \(subjects).", table: "Plan",
        comment: "Says the plan gives these subjects less time")
    case "skipAreas":
      return count == 1
        ? String(
          localized: "\(subjects) isn't in your plan.", table: "Plan",
          comment: "Says one subject left the plan")
        : String(
          localized: "\(subjects) aren't in your plan.", table: "Plan",
          comment: "Says several subjects left the plan")
    case "restoreAreas":
      return addedStatement(subjects, count: count)
    case "setAreaStart":
      if operation.start == "pastBasics" {
        return String(
          localized: "Your plan skips the basics of \(subjects).", table: "Plan",
          comment: "Says the plan starts these subjects past their basics")
      }

      return count == 1
        ? String(
          localized: "\(subjects) starts from the basics.", table: "Plan",
          comment: "Says one subject starts from its basics")
        : String(
          localized: "\(subjects) start from the basics.", table: "Plan",
          comment: "Says several subjects start from their basics")
    case "setDailyMinutes":
      return String(
        localized: "You now study \(time) a day.", table: "Plan",
        comment: "Says the time a day changed; the argument is a duration like \"30 min\"")
    case "setWeekdayMinutes":
      let days = days(operation).labelCased()

      return operation.minutes == 0
        ? String(
          localized: "\(days): rest day.", table: "Plan",
          comment: "Says weekdays became rest days; the argument lists weekdays")
        : String(
          localized: "\(days): \(time) a day.", table: "Plan",
          comment: "Says weekdays' time changed; the first argument lists weekdays")
    case "addLightWeek":
      return String(
        localized:
          "A lighter week from \(PlanDate.longDay(operation.startDate ?? today, today: today)), at half the time.",
        table: "Plan", comment: "Says a week at half the time starts; the argument is a day")
    case "moveWeeklyEvent":
      return String(
        localized:
          "This week's challenge moved to \(PlanDate.longDay(operation.to ?? today, today: today)).",
        table: "Plan", comment: "Says the week's challenge moved; the argument is a day")
    case "setTargetDate", "setNoticeDate":
      return dateStatement(operation.targetDate, dateKind: dateKind)
    case "setFullCourse":
      return fullCourseStatement(operation.fullCourse == true)
    case "skipActivities":
      return String(
        localized:
          "Your lessons no longer have \((operation.activities ?? []).map(planActivityName).formatted(.list(type: .and))).",
        table: "Plan", comment: "Says practice activities left the lessons, such as Listening")
    case "restoreActivities":
      return String(
        localized:
          "\((operation.activities ?? []).map(planActivityName).formatted(.list(type: .and))) back in your lessons.",
        table: "Plan", comment: "Says practice activities are back in the lessons")
    case "setPracticeBias":
      return operation.bias == "morePractice"
        ? String(
          localized: "More practice from now on.", table: "Plan",
          comment: "Says the lessons have more practice")
        : String(
          localized: "More explanation from now on.", table: "Plan",
          comment: "Says the lessons have more explanation")
    case "setDifficultyBias":
      switch operation.bias {
      case "harder":
        return String(
          localized: "Harder lessons from now on.", table: "Plan",
          comment: "Says the lessons are harder")
      case "easier":
        return String(
          localized: "Easier lessons from now on.", table: "Plan",
          comment: "Says the lessons are easier")
      default:
        return String(
          localized: "Lessons at the usual difficulty from now on.", table: "Plan",
          comment: "Says the lessons are back at the usual difficulty")
      }
    case "setBaseChoices":
      return planBaseChoicesStatement((operation.choices ?? []).map(\.choice))
    case "setAim":
      return aimStatement(operation.aim ?? "")
    case "fitLessons":
      return String(
        localized: "Lessons added to your plan.", table: "Plan",
        comment: "Says the lessons the learner's time fits joined the plan")
    case "fitPhaseDates":
      return String(
        localized: "Your phase dates moved.", table: "Plan", comment: "Says the phases' ends moved")
    case "setExamChoice":
      return String(
        localized:
          "\(operation.group ?? ""): \((operation.subjects ?? []).formatted(.list(type: .and))).",
        table: "Plan",
        comment:
          "Says which options the plan studies for an exam's choice: the choice, like its foreign language, then the options"
      )
    default:
      return String(
        localized: "Your plan changed.", table: "Plan", comment: "A plan change, applied")
    }
  }

  private static func addedStatement(_ names: String, count: Int) -> String {
    count == 1
      ? String(
        localized: "\(names) added to your plan.", table: "Plan",
        comment: "Says one topic or subject joined the plan")
      : String(
        localized: "planChangeSeveralAdded", defaultValue: "\(names) added to your plan.",
        table: "Plan", comment: "Says several topics or subjects joined the plan, named as a list")
  }

  static func dateStatement(_ target: String?, dateKind: GoalDateKind) -> String {
    guard let target else {
      return String(
        localized: "Your plan has no end date.", table: "Plan",
        comment: "Says the goal no longer has a date")
    }

    let date = PlanDate.longDay(target, today: PlanDate.today())

    switch dateKind {
    case .exam:
      return String(
        localized: "Exam date: \(date).", table: "Plan",
        comment: "Says the exam's date changed; the argument is a day like \"May 5\"")
    case .goal:
      return String(
        localized: "End date: \(date).", table: "Plan",
        comment: "Says the goal's end date changed; the argument is a day like \"May 5\"")
    case .unknown:
      return String(
        localized: "Date moved to \(date).", table: "Plan",
        comment: "Says the goal's date changed; the argument is a day like \"May 5\"")
    }
  }

  static func fullCourseStatement(_ on: Bool) -> String {
    on
      ? String(
        localized: "Your plan goes on after the exam.", table: "Plan",
        comment: "Says the plan keeps studying after the exam")
      : String(
        localized: "Your plan ends at the exam.", table: "Plan",
        comment: "Says the plan stops at the exam")
  }

  static func aimStatement(_ aim: String) -> String {
    String(
      localized: "Level to reach: \(aim).", table: "Plan",
      comment: "Says a language course's level to reach changed; the argument is a level like B1")
  }
}

/// "Prerequisites: 8 with every lesson, 3 with the first lessons only and 2 skipped."
func planBaseChoicesStatement(_ choices: [BaseChoice]) -> String {
  let count = { (choice: BaseChoice) in choices.filter { $0 == choice }.count }
  let deep = count(.deep)
  let essential = count(.essential)
  let quick = count(.quick)
  let skip = count(.skip)
  let parts = [
    deep > 0
      ? String(
        localized: "\(deep) with every lesson", table: "Plan",
        comment: "Part of the prerequisites statement: how many are studied with every lesson")
      : nil,
    essential > 0
      ? String(
        localized: "\(essential) with the first lessons only", table: "Plan",
        comment:
          "Part of the prerequisites statement: how many are studied with their first lessons only")
      : nil,
    quick > 0
      ? String(
        localized: "\(quick) with one short lesson", table: "Plan",
        comment: "Part of the prerequisites statement: how many are studied with one short lesson")
      : nil,
    skip > 0
      ? String(
        localized: "\(skip) skipped", table: "Plan",
        comment: "Part of the prerequisites statement: how many are skipped")
      : nil,
  ].compactMap(\.self)

  return String(
    localized: "Prerequisites: \(parts.formatted(.list(type: .and))).", table: "Plan",
    comment: "Says how the plan studies its prerequisites; the argument lists the choices")
}

func planActivityName(_ activity: String) -> String {
  switch activity {
  case "vocabulary": String(localized: "New words", table: "Plan", comment: "Practice activity")
  case "listening": String(localized: "Listening", table: "Plan", comment: "Practice activity")
  case "writing": String(localized: "Writing", table: "Plan", comment: "Practice activity")
  default: String(localized: "Speaking", table: "Plan", comment: "Practice activity")
  }
}
