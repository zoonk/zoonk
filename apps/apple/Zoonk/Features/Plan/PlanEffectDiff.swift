import SwiftUI

/// Whose date a change's lessons are counted against: `unknown` where a card can't tell.
enum GoalDateKind {
  case exam
  case goal
  case unknown

  init(isExam: Bool?) {
    switch isExam {
    case true?: self = .exam
    case false?: self = .goal
    case nil: self = .unknown
    }
  }
}

/// The goal's own date a change moves, said in its rows instead of as a consequence.
struct GoalDateMove: Equatable {
  let after: String
  let before: String?
}

/// Main's `ChangeOptions`: without a date the plan keeps every lesson, so only the net count
/// changes (`byDate` false).
struct PlanChangeOptions {
  var byDate = true
  var dateKind = GoalDateKind.unknown
  var goalDate: GoalDateMove?
}

/// The one thing a learner would notice about a change. `whole` is false when its row says more.
struct PlanChangeConsequence: Equatable {
  let key: String
  let text: String
  let whole: Bool
}

/// A plain row behind "See all changes": a label, then "before → after" or a value.
struct PlanChangeRow: Equatable, Identifiable {
  let key: String
  let label: String
  var before: String?
  let after: String
  var detail: String?

  var id: String { key }
}

/// Main's `usePlanChangeConsequence` and `usePlanChangeRows`: what a plan change does, as one
/// sentence and as rows.
enum PlanChangeEffect {
  private static let namedInSentence = 3
  private static let namedInRow = 8

  static func consequence(
    _ effect: PlanEffect?, _ options: PlanChangeOptions = .init(), today: String
  ) -> PlanChangeConsequence? {
    guard let effect else {
      return nil
    }

    let lessons = lessonConsequence(effect, options)

    if lessons?.key == "notInPlan" {
      return lessons
    }

    return endConsequence(effect, options, today: today) ?? lessons
      ?? eventConsequence(effect, today: today)
  }

  static func rows(_ effect: PlanEffect?, _ options: PlanChangeOptions = .init(), today: String)
    -> [PlanChangeRow]
  {
    guard let effect else {
      return []
    }

    return lessonRows(effect, options) + dateRows(effect, options, today: today)
      + eventRows(effect, today: today)
  }

  /// Not by a day or less while lessons change: an end a day earlier beside lessons left out reads
  /// backwards.
  static func shownEndMove(_ effect: PlanEffect) -> (after: String, before: String)? {
    guard let after = effect.endDateAfter, let before = effect.endDateBefore, after != before else {
      return nil
    }

    let lessonsChange = effect.lessonsAdded > 0 || effect.lessonsRemoved > 0
    let rounding = abs(PlanDate.days(from: before, to: after)) <= 1
    return lessonsChange && rounding ? nil : (after, before)
  }

  static func topicNames(_ areas: [PlanEffect.Topics]?) -> [String] {
    (areas ?? []).flatMap { $0.topics.map(planTopicWords) }
  }

  private static func counts(_ effect: PlanEffect, byDate: Bool) -> (added: Int, removed: Int) {
    if byDate {
      return (effect.lessonsAdded, effect.lessonsRemoved)
    }

    let net = effect.lessonsAdded - effect.lessonsRemoved
    return (max(net, 0), max(-net, 0))
  }

  // MARK: The sentence

  private static func lessonConsequence(_ effect: PlanEffect, _ options: PlanChangeOptions)
    -> PlanChangeConsequence?
  {
    let topicsOut = topicNames(effect.topicsLeftOut)
    let topicsIn = topicNames(effect.topicsAdded)
    let (added, removed) = counts(effect, byDate: options.byDate)

    if !topicsOut.isEmpty {
      let topics = planTopicList(topicsOut, named: namedInSentence)

      return PlanChangeConsequence(
        key: "notInPlan",
        text: topicsOut.count == 1
          ? String(
            localized: "\(topics) won't be in your plan.", table: "Plan",
            comment: "A plan change's consequence: one topic leaves the plan")
          : String(
            localized: "planChangeTopicsLeave", defaultValue: "\(topics) won't be in your plan.",
            table: "Plan",
            comment:
              "A plan change's consequence: several topics leave the plan, named as a list such as \"Statistics, Geometry and 3 more topics\""
          ),
        whole: topicsOut.count <= namedInSentence && removed == 0)
    }

    if options.byDate && removed > 0 {
      let left = (effect.lessonsLeftOut ?? []).count + (effect.unwrittenLeftOut ?? []).count

      return PlanChangeConsequence(
        key: "notInPlan", text: fewerLessons(removed, options.dateKind), whole: left == 0)
    }

    if !topicsIn.isEmpty {
      let topics = planTopicList(topicsIn, named: namedInSentence)

      return PlanChangeConsequence(
        key: "added",
        text: topicsIn.count == 1
          ? String(
            localized: "\(topics) will be added to your plan.", table: "Plan",
            comment: "A plan change's consequence: one topic joins the plan")
          : String(
            localized: "planChangeTopicsJoin",
            defaultValue: "\(topics) will be added to your plan.", table: "Plan",
            comment:
              "A plan change's consequence: several topics join the plan, named as a list such as \"Statistics, Geometry and 3 more topics\""
          ),
        whole: topicsIn.count <= namedInSentence && added == 0)
    }

    return options.byDate && added > 0
      ? PlanChangeConsequence(
        key: "added", text: moreLessons(added, options.dateKind), whole: true)
      : nil
  }

  /// What a learner studies before their date, said for them and never for the lessons.
  private static func fewerLessons(_ count: Int, _ dateKind: GoalDateKind) -> String {
    switch dateKind {
    case .exam:
      String(
        localized: "You'll study \(count) fewer lessons before your exam.", table: "Plan",
        comment: "A plan change's consequence: lessons that leave a plan with an exam date")
    case .goal:
      String(
        localized: "You'll study \(count) fewer lessons before your end date.", table: "Plan",
        comment: "A plan change's consequence: lessons that leave a plan with an end date")
    case .unknown:
      String(
        localized: "You'll study \(count) fewer lessons.", table: "Plan",
        comment: "A plan change's consequence: lessons that leave the plan")
    }
  }

  private static func moreLessons(_ count: Int, _ dateKind: GoalDateKind) -> String {
    switch dateKind {
    case .exam:
      String(
        localized: "You'll study \(count) more lessons before your exam.", table: "Plan",
        comment: "A plan change's consequence: lessons that join a plan with an exam date")
    case .goal:
      String(
        localized: "You'll study \(count) more lessons before your end date.", table: "Plan",
        comment: "A plan change's consequence: lessons that join a plan with an end date")
    case .unknown:
      String(
        localized: "You'll study \(count) more lessons.", table: "Plan",
        comment: "A plan change's consequence: lessons that join the plan")
    }
  }

  /// A change that moves the goal's own date already says the date in its title.
  private static func endConsequence(
    _ effect: PlanEffect, _ options: PlanChangeOptions, today: String
  ) -> PlanChangeConsequence? {
    guard options.goalDate == nil, let end = shownEndMove(effect) else {
      return nil
    }

    let after = PlanDate.longDay(end.after, today: today)
    let before = PlanDate.longDay(end.before, today: today)

    return PlanChangeConsequence(
      key: "end",
      text: String(
        localized: "Your plan will end on \(after) instead of \(before).", table: "Plan",
        comment:
          "A plan change's consequence: the plan's end moves; the arguments are days like \"May 5\""
      ),
      whole: true)
  }

  private static func eventConsequence(_ effect: PlanEffect, today: String)
    -> PlanChangeConsequence?
  {
    let phases = effect.phaseEnds ?? []

    if let phase = phases.first, phases.count == 1, phase.after != phase.before {
      let after = PlanDate.longDay(phase.after, today: today)
      let before = PlanDate.longDay(phase.before, today: today)

      return PlanChangeConsequence(
        key: "phase:\(phase.name)",
        text: String(
          localized: "\(phase.name) will end on \(after) instead of \(before).", table: "Plan",
          comment:
            "A plan change's consequence: a phase's end moves; the first argument is the phase's name, the others days like \"May 5\""
        ),
        whole: true)
    }

    if let mock = effect.nextMock {
      return PlanChangeConsequence(
        key: "nextMock",
        text: String(
          localized: "Your next mock exam will be on \(PlanDate.weekdayDay(mock.after)).",
          table: "Plan",
          comment:
            "A plan change's consequence: the next mock exam moves; the argument is a weekday and day like \"Monday, May 5\""
        ),
        whole: true)
    }

    guard let weekly = effect.weeklyEvents else {
      return nil
    }

    let day = planWeekdayName(weekly.after)

    return PlanChangeConsequence(
      key: "weekly",
      text: weekly.kind == "mock"
        ? String(
          localized: "Your mock exams will be on \(day).", table: "Plan",
          comment:
            "A plan change's consequence: the weekly mock exams move; the argument is a weekday"
        )
        : String(
          localized: "Your weekly challenge will be on \(day).", table: "Plan",
          comment:
            "A plan change's consequence: the weekly challenge moves; the argument is a weekday"
        ),
      whole: true)
  }

  // MARK: The rows

  private static func lessonRows(_ effect: PlanEffect, _ options: PlanChangeOptions)
    -> [PlanChangeRow]
  {
    let (added, removed) = counts(effect, byDate: options.byDate)

    guard options.byDate else {
      guard added != removed else {
        return []
      }

      return [
        PlanChangeRow(
          key: "lessons",
          label: String(
            localized: "Lessons", table: "Plan",
            comment: "A row of a plan change's details: the net change in its lessons"),
          after: removed > 0
            ? String(
              localized: "\(removed) fewer", table: "Plan",
              comment: "A row of a plan change's details: lessons fewer")
            : String(
              localized: "\(added) more", table: "Plan",
              comment: "A row of a plan change's details: lessons more"))
      ]
    }

    let topicsOut = topicNames(effect.topicsLeftOut)
    let lessonsOut =
      (effect.lessonsLeftOut ?? []) + (effect.unwrittenLeftOut ?? []).map(\.skill)
    let outNames =
      topicsOut.isEmpty
      ? planLessonList(lessonsOut, named: namedInRow)
      : planTopicList(topicsOut, named: namedInRow)
    let inNames = planTopicList(
      topicNames(effect.topicsAdded) + (effect.outcomesAdded ?? []), named: namedInRow)

    return [
      lessonRow(
        key: "notInPlan",
        label: String(
          localized: "Not in your plan", table: "Plan",
          comment: "A row of a plan change's details: what leaves the plan"),
        count: removed, names: outNames),
      lessonRow(
        key: "added",
        label: String(
          localized: "Added to your plan", table: "Plan",
          comment: "A row of a plan change's details: what joins the plan"),
        count: added, names: inNames),
    ].compactMap(\.self)
  }

  private static func lessonRow(key: String, label: String, count: Int, names: String)
    -> PlanChangeRow?
  {
    if count > 0 {
      return PlanChangeRow(
        key: key, label: label,
        after: String(
          localized: "\(count) lessons", table: "Plan",
          comment: "A row of a plan change's details: how many lessons"),
        detail: names.isEmpty ? nil : names)
    }

    return names.isEmpty ? nil : PlanChangeRow(key: key, label: label, after: names)
  }

  private static func dateRows(
    _ effect: PlanEffect, _ options: PlanChangeOptions, today: String
  ) -> [PlanChangeRow] {
    let date = { (iso: String) in PlanDate.text(iso, today: today) }
    let goalDate = options.goalDate.flatMap { move in
      moved(
        key: "goalDate",
        label: options.dateKind == .exam
          ? String(
            localized: "Exam date", table: "Plan",
            comment: "A row of a plan change's details: the exam's date")
          : String(
            localized: "End date", table: "Plan",
            comment: "A row of a plan change's details: the goal's end date"),
        before: move.before.map(date), after: date(move.after))
    }
    let end = shownEndMove(effect).flatMap { end in
      moved(
        key: "end",
        label: String(
          localized: "Plan ends", table: "Plan",
          comment: "A row of a plan change's details: the day the plan ends"),
        before: date(end.before), after: date(end.after))
    }
    let phases = (effect.phaseEnds ?? []).map { phase in
      moved(
        key: "phase:\(phase.name)", label: endsLabel(phase.name), before: date(phase.before),
        after: date(phase.after))
    }
    let starts = (effect.areaStarts ?? []).map { area in
      area.after.flatMap { after in
        moved(
          key: "start:\(area.area)",
          label: String(
            localized: "\(area.area) starts", table: "Plan",
            comment: "A row of a plan change's details: the day a subject starts"),
          before: area.before.map(date), after: date(after))
      }
    }
    let ends = (effect.areaEnds ?? []).map { area in
      moved(
        key: "end:\(area.area)", label: endsLabel(area.area), before: date(area.before),
        after: date(area.after))
    }

    return ([goalDate, end] + phases + starts + ends).compactMap(\.self)
  }

  private static func endsLabel(_ name: String) -> String {
    String(
      localized: "\(name) ends", table: "Plan",
      comment: "A row of a plan change's details: the day a phase or subject ends")
  }

  private static func moved(key: String, label: String, before: String?, after: String)
    -> PlanChangeRow?
  {
    after == before ? nil : PlanChangeRow(key: key, label: label, before: before, after: after)
  }

  private static func eventRows(_ effect: PlanEffect, today: String) -> [PlanChangeRow] {
    let date = { (iso: String) in PlanDate.text(iso, today: today) }
    let areas = (effect.areaLessons ?? []).map { area in
      PlanChangeRow(
        key: "lessons:\(area.area)", label: area.area, before: String(area.before),
        after: area.after == 0
          ? String(
            localized: "0 lessons to go", table: "Plan",
            comment: "A row of a plan change's details: a subject with no lessons left to do")
          : String(
            localized: "\(area.after) lessons to go", table: "Plan",
            comment: "A row of a plan change's details: a subject's lessons still to do"))
    }
    let mock = effect.nextMock.map { mock in
      PlanChangeRow(
        key: "nextMock",
        label: String(
          localized: "Next mock exam", table: "Plan",
          comment: "A row of a plan change's details: the next mock exam's day"),
        before: date(mock.before), after: date(mock.after))
    }
    let weekly = effect.weeklyEvents.map { weekly in
      PlanChangeRow(
        key: "weekly",
        label: weekly.kind == "mock"
          ? String(
            localized: "Mock exams", table: "Plan",
            comment: "A row of a plan change's details: the weekday of the weekly mock exams")
          : String(
            localized: "Weekly challenge", table: "Plan",
            comment: "A row of a plan change's details: the weekday of the weekly challenge"),
        before: planWeekdayName(weekly.before).labelCased(),
        after: planWeekdayName(weekly.after).labelCased())
    }
    let review = effect.reviewFirst.map { review in
      PlanChangeRow(
        key: "reviewFirst",
        label: String(
          localized: "Review on \(date(review.date))", table: "Plan",
          comment:
            "A row of a plan change's details: a review day; the argument is a day like \"May 5\""
        ),
        after: String(
          localized: "Starts with \(review.areas.formatted(.list(type: .and)))", table: "Plan",
          comment: "A row of a plan change's details: the subjects a review asks first"))
    }
    let newStart = effect.addedTopicsStart.map { start in
      PlanChangeRow(
        key: "addedStart",
        label: String(
          localized: "New lessons start", table: "Plan",
          comment: "A row of a plan change's details: the day the topics added start"),
        after: date(start))
    }

    return areas + [mock, weekly, review, newStart].compactMap(\.self)
  }
}

/// Main's `PlanEffectDiff`: the one consequence a learner would notice, and every other change
/// behind "See all changes". `repriced` says the learner accepted other numbers: the ones under it
/// are today's, to answer again.
struct PlanEffectDiff: View {
  let effect: PlanEffect?
  let today: String
  var options = PlanChangeOptions()
  var repriced = false
  /// False where the screen's own sentence already says what matters most.
  var summary = true
  /// The screen's title already states the lessons added, so the same count isn't said twice.
  var saysLessonsAdded = false

  var body: some View {
    let found = PlanChangeEffect.consequence(effect, options, today: today)
    let rows = PlanChangeEffect.rows(effect, options, today: today)
    let namesAdded =
      !(effect?.topicsAdded ?? []).isEmpty || !(effect?.outcomesAdded ?? []).isEmpty
    let repeatsTitle = saysLessonsAdded && found?.key == "added" && !namesAdded
    let stated = summary ? found : nil
    let consequence = summary && !repeatsTitle ? found : nil
    let onlyRow = rows.count == 1 && rows.first?.key == stated?.key
    let hasMore = !rows.isEmpty && !(onlyRow && stated?.whole == true)

    if consequence != nil || hasMore || repriced {
      VStack(alignment: .leading, spacing: 6) {
        if repriced {
          Group {
            if effect != nil {
              Text(
                "The numbers are different today.", tableName: "Plan",
                comment:
                  "Over a plan change the learner accepted: its numbers changed since it was worked out, so it asks again with today's"
              )
            } else {
              Text(
                "Your plan stays as it is.", tableName: "Plan",
                comment: "A plan change that would change nothing anymore")
            }
          }
          .typeStyle(.note.weight(.medium))
        }

        if let consequence {
          Text(consequence.text)
            .typeStyle(.note)
        }

        if hasMore {
          PlanChangeRows(rows: rows)
        }
      }
    }
  }
}

/// "See all changes": a quiet disclosure of plain rows, a label and "before → after" or a value.
private struct PlanChangeRows: View {
  @State private var isOpen = false

  let rows: [PlanChangeRow]

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Button {
        isOpen.toggle()
      } label: {
        HStack(spacing: 4) {
          Text(
            "See all changes", tableName: "Plan", comment: "Shows every change a plan change makes")

          Image(systemName: "chevron.down")
            .imageScale(.small)
            .rotationEffect(.degrees(isOpen ? 180 : 0))
            .accessibilityHidden(true)
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
        .frame(minHeight: 44, alignment: .leading)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .accessibilityValue(
        isOpen
          ? Text("Expanded", tableName: "Plan", comment: "Spoken state of an open disclosure")
          : Text("Collapsed", tableName: "Plan", comment: "Spoken state of a closed disclosure"))

      if isOpen {
        ForEach(rows) { row in
          if row.id != rows.first?.id {
            Divider()
          }

          VStack(alignment: .leading, spacing: 2) {
            ViewThatFits(in: .horizontal) {
              HStack(alignment: .firstTextBaseline, spacing: 16) {
                Text(row.label)
                Spacer(minLength: 0)
                value(row)
              }

              VStack(alignment: .leading, spacing: 2) {
                Text(row.label)
                value(row)
              }
            }

            if let detail = row.detail {
              Text(detail)
                .foregroundStyle(.mutedForeground)
            }
          }
          .typeStyle(.note)
          .padding(.vertical, 8)
          .accessibilityElement(children: .combine)
        }
      }
    }
  }

  private func value(_ row: PlanChangeRow) -> Text {
    let after = Text(row.after)

    guard let before = row.before else {
      return after.monospacedDigit()
    }

    return Text(
      "\(Text(before).foregroundStyle(.mutedForeground)) → \(after)", tableName: "Plan",
      comment: "A row of a plan change's details: the value before the change, then after it"
    )
    .monospacedDigit()
  }
}

/// Main's `useShortList` for topics: a notice's item number ("12 Noções…") would read as a count.
func planTopicList(_ names: [String], named: Int = 3) -> String {
  let words = names.map(planTopicWords)

  guard words.count > named else {
    return words.formatted(.list(type: .and))
  }

  return String(
    localized:
      "\(words.prefix(named).joined(separator: ", ")) and \(words.count - named) more topics",
    table: "Plan", comment: "A few topic names and how many more")
}

/// Lesson names are examples, since one name can stand for several lessons: the list ends "and
/// more", never with a count that wouldn't add up.
func planLessonList(_ names: [String], named: Int) -> String {
  guard names.count > named else {
    return names.formatted(.list(type: .and))
  }

  return String(
    localized: "\(names.prefix(named).joined(separator: ", ")) and more", table: "Plan",
    comment:
      "A few of the lessons a plan change affects, as examples; the full count is shown beside them"
  )
}

func planTopicWords(_ name: String) -> String {
  let numbered = /^\s*\d{1,3}(?:\.\d{1,3})*\.?\s+(?<text>\S.*)$/.dotMatchesNewlines()
  let coded = /^\s*[A-Z]{1,3}\d{1,3}\s*[-–—:]\s+(?<text>\S.*)$/.dotMatchesNewlines()

  if let match = try? numbered.wholeMatch(in: name) {
    return String(match.text)
  }

  if let match = try? coded.wholeMatch(in: name) {
    return String(match.text)
  }

  return name
}

/// Sunday counted 0.
func planWeekdayName(_ weekday: Int) -> String {
  Calendar.current.weekdaySymbols[((weekday % 7) + 7) % 7]
}
