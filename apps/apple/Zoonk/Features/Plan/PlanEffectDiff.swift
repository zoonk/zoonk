import SwiftUI

struct PlanEffectLine: Equatable {
  enum Kind {
    case added
    case removed
  }

  /// Lessons left out by the date are bad news, not a mistake.
  enum Tone {
    case bad
    case good
    case neutral
  }

  let kind: Kind
  let text: String
  let tone: Tone
}

/// Main's `PlanEffectDiff` for a plan with a date: what a change moves, from now to after it.
enum PlanEffectLines {
  static func lines(_ effect: PlanEffect?, today: String) -> [PlanEffectLine] {
    guard let effect else {
      return []
    }

    let date = { (iso: String) in PlanDate.text(iso, today: today) }
    let end = shownEndMove(effect).map { move in
      moved(
        after: String(
          localized: "Plan ends \(date(move.after))", table: "Plan",
          comment: "A line of a change's diff: the day the plan ends"),
        before: String(
          localized: "Plan ends \(date(move.before))", table: "Plan",
          comment: "A line of a change's diff: the day the plan ends"))
    }
    let phases = (effect.phaseEnds ?? []).flatMap { phase in
      moved(
        after: until(phase.name, date(phase.after)), before: until(phase.name, date(phase.before)))
    }
    let areas = (effect.areaEnds ?? []).flatMap { area in
      moved(after: until(area.area, date(area.after)), before: until(area.area, date(area.before)))
    }
    let areaLessons = (effect.areaLessons ?? []).flatMap { area in
      moved(after: toGo(area.area, area.after), before: toGo(area.area, area.before))
    }
    let mock = effect.nextMock.map { mock in
      moved(
        after: String(
          localized: "Next mock \(date(mock.after))", table: "Plan",
          comment: "A line of a change's diff: the day of the next mock exam"),
        before: String(
          localized: "Next mock \(date(mock.before))", table: "Plan",
          comment: "A line of a change's diff: the day of the next mock exam"))
    }
    let week = effect.weeklyEvents.map { events in
      moved(
        after: weekly(events.kind, events.after), before: weekly(events.kind, events.before))
    }

    return lessons(effect) + (end ?? []) + phases + areas + areaLessons + (mock ?? [])
      + (week ?? [])
  }

  private static func lessons(_ effect: PlanEffect) -> [PlanEffectLine] {
    let added = effect.lessonsAdded
    let removed = effect.lessonsRemoved
    let addedText =
      effect.lessonsAddedEstimated == true
      ? String(
        localized: "Adds about \(added) lessons", table: "Plan",
        comment: "A line of a change's diff: lessons it adds, some not written yet")
      : String(
        localized: "Adds \(added) lessons", table: "Plan",
        comment: "A line of a change's diff: lessons it adds")

    return [
      removed > 0
        ? PlanEffectLine(
          kind: .removed,
          text: String(
            localized: "Leaves out \(removed) lessons", table: "Plan",
            comment: "A line of a change's diff: lessons it leaves out of the plan"),
          tone: .bad) : nil,
      added > 0 ? PlanEffectLine(kind: .added, text: addedText, tone: .good) : nil,
    ].compactMap(\.self)
  }

  /// Not by a day or less while lessons change: an end a day earlier beside lessons left out reads
  /// backwards.
  private static func shownEndMove(_ effect: PlanEffect) -> (after: String, before: String)? {
    guard let after = effect.endDateAfter, let before = effect.endDateBefore, after != before else {
      return nil
    }

    let lessonsChange = effect.lessonsAdded > 0 || effect.lessonsRemoved > 0
    let rounding = abs(PlanDate.days(from: before, to: after)) <= 1
    return lessonsChange && rounding ? nil : (after, before)
  }

  private static func moved(after: String, before: String) -> [PlanEffectLine] {
    after == before
      ? []
      : [
        PlanEffectLine(kind: .removed, text: before, tone: .neutral),
        PlanEffectLine(kind: .added, text: after, tone: .neutral),
      ]
  }

  private static func until(_ name: String, _ date: String) -> String {
    String(
      localized: "\(name) until \(date)", table: "Plan",
      comment: "A line of a change's diff: the day a phase or subject ends")
  }

  private static func toGo(_ area: String, _ count: Int) -> String {
    String(
      localized: "\(area): \(count) lessons to go", table: "Plan",
      comment: "A line of a change's diff: a subject's lessons still to do")
  }

  private static func weekly(_ kind: String, _ weekday: Int) -> String {
    let name = Calendar.current.weekdaySymbols[weekday % 7]

    return kind == "mock"
      ? String(
        localized: "Mock exams on \(name)", table: "Plan",
        comment: "A line of a change's diff: the weekday of the weekly mock exams")
      : String(
        localized: "Weekly challenges on \(name)", table: "Plan",
        comment: "A line of a change's diff: the weekday of the weekly challenges")
  }
}

struct PlanEffectDiff: View {
  let effect: PlanEffect?
  let today: String

  var body: some View {
    let lines = PlanEffectLines.lines(effect, today: today)

    if !lines.isEmpty {
      VStack(alignment: .leading, spacing: 4) {
        ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
          Label {
            Text(line.text)
          } icon: {
            Image(systemName: line.kind == .added ? "plus" : "minus")
          }
          .foregroundStyle(style(line))
          .accessibilityElement(children: .ignore)
          .accessibilityLabel(
            line.kind == .added
              ? Text(
                "After the change: \(line.text)", tableName: "Plan",
                comment: "Spoken line of a change's diff, as it'll be")
              : Text(
                "Now: \(line.text)", tableName: "Plan",
                comment: "Spoken line of a change's diff, as it is"))
        }
      }
      .font(.subheadline)
    }
  }

  private func style(_ line: PlanEffectLine) -> AnyShapeStyle {
    switch (line.tone, line.kind) {
    case (.bad, _): AnyShapeStyle(.warning)
    case (.good, _): AnyShapeStyle(.success)
    case (.neutral, .added): AnyShapeStyle(.primary)
    case (.neutral, .removed): AnyShapeStyle(.secondary)
    }
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
