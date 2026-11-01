import SwiftUI

/// Main's `PlanReceipt`.
struct PlanSoFar: View {
  let facts: [PlanFact]

  var body: some View {
    List {
      Section {
        ForEach(facts) { fact in
          VStack(alignment: .leading, spacing: 2) {
            Text(fact.label)
              .font(.subheadline)
              .foregroundStyle(.secondary)

            Text(fact.value)
              .monospacedDigit()

            if let note = fact.note {
              Text(note)
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            if let daysLeft = fact.daysLeft {
              Text(daysLeft)
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(.secondary)
            }
          }
          .accessibilityElement(children: .combine)
        }
      } header: {
        Text(
          "Your plan so far", tableName: "Onboarding",
          comment: "Heading over what the learner's answers have set for their plan")
      }
    }
  }
}

struct PlanFact: Identifiable, Equatable {
  let id: String
  let label: LocalizedStringResource
  let value: String
  var daysLeft: String?
  var note: String?

  /// `today` is the goal's today, `YYYY-MM-DD`.
  static func all(
    of goal: Components.Schemas.Goal, today: String, locale: Locale = .current
  ) -> [PlanFact] {
    let details = try? PracticeJSON.recode(goal.details, as: Details.self)
    let understood = (try? UnderstoodFacts(goal)).map {
      UnderstoodRows.languageRows(facts: $0, locale: locale)
        + UnderstoodRows.detailRows(facts: $0, cutoff: nil)
    }

    return [
      PlanFact(
        id: "title",
        label: LocalizedStringResource(
          "Goal", table: "Onboarding", comment: "Row naming an understood goal"),
        value: goal.title),
      date(of: goal, answered: details?.answered ?? [], today: today),
    ].compactMap { $0 }
      + (understood ?? []).map {
        PlanFact(id: $0.id, label: $0.label, value: $0.value, note: $0.note)
      }
      + [level(details), time(of: goal, answered: details?.answered ?? [])].compactMap { $0 }
  }

  /// Main's `PlanReceiptChips`: the short facts, the date as its days left.
  static func chips(_ facts: [PlanFact]) -> String {
    let shown: Set = [
      "title", "date", "targetLanguage", "targetCourse", "institution", "targetPosition",
      "targetScore",
    ]

    return facts.filter { shown.contains($0.id) }.map { $0.daysLeft ?? $0.value }.joinedFacts()
  }

  private struct Details: Decodable {
    let answered: [String]
    let level: String?
    let levelNote: String?

    private enum CodingKeys: String, CodingKey {
      case answered, level, levelNote
    }

    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      answered = (try? container.decodeIfPresent([String].self, forKey: .answered)) ?? []
      level = try? container.decodeIfPresent(String.self, forKey: .level)
      levelNote = try? container.decodeIfPresent(String.self, forKey: .levelNote)
    }
  }

  private static func date(
    of goal: Components.Schemas.Goal, answered: [String], today: String
  ) -> PlanFact? {
    let label =
      goal.kind == .exam
      ? LocalizedStringResource(
        "Exam date", table: "Onboarding", comment: "Row with an exam's date")
      : LocalizedStringResource(
        "Date", table: "Onboarding", comment: "Row with the date a goal aims for")

    guard let targetDate = goal.targetDate else {
      return answered.contains("targetDate")
        ? PlanFact(
          id: "date", label: label,
          value: String(
            localized: "No date", table: "Onboarding",
            comment: "A goal the learner chose to study without a date"))
        : nil
    }

    let days = PlanDate.days(from: today, to: targetDate)

    return PlanFact(
      id: "date", label: label, value: PlanDate.longText(targetDate),
      // Never "0 days": Portuguese's singular covers 0, and a date that's today gets asked again.
      daysLeft: days > 0
        ? String(
          localized: "\(days) days", table: "Onboarding", comment: "How long until a goal's date")
        : nil)
  }

  /// Main's `readSetupLevel`: a level test's result, then the level the learner picked, then the
  /// level their words gave.
  private static func level(_ details: Details?) -> PlanFact? {
    guard let details else {
      return nil
    }

    let own = details.level.flatMap(OwnLevel.init(rawValue:))
    let note = details.levelNote?.trimmingCharacters(in: .whitespacesAndNewlines)

    let value: String? =
      if let tested = details.level,
        tested.trimmingCharacters(in: .whitespaces).uppercased()
          .wholeMatch(of: /(A1|A2|B1|B2|C1|C2)\+?/) != nil
      {
        tested
      } else if let own, details.answered.contains("level") {
        String(localized: own.label)
      } else if let note, !note.isEmpty {
        note
      } else {
        own.map { String(localized: $0.label) }
      }

    return value.map {
      PlanFact(
        id: "level",
        label: LocalizedStringResource(
          "Your level", table: "Onboarding", comment: "Row with the learner's level in a subject"),
        value: $0)
    }
  }

  private static func time(of goal: Components.Schemas.Goal, answered: [String]) -> PlanFact? {
    guard answered.contains("schedule") else {
      return nil
    }

    return PlanFact(
      id: "time",
      label: LocalizedStringResource(
        "Time a day", table: "Onboarding", comment: "Label of the daily study time picker"),
      value: planDurationText(minutes: Double(goal.dailyMinutes)))
  }
}
