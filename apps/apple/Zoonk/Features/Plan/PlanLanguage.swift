import SwiftUI

/// A language skill's name: "Reading", "Speaking".
func languageSkillName(_ skill: String) -> String {
  switch skill {
  case "reading": String(localized: "Reading", table: "Plan", comment: "A language skill")
  case "listening": String(localized: "Listening", table: "Plan", comment: "A language skill")
  case "speaking": String(localized: "Speaking", table: "Plan", comment: "A language skill")
  default: String(localized: "Writing", table: "Plan", comment: "A language skill")
  }
}

extension LanguageStanding {
  /// "Speaking leads": the skill ahead of the others, or that they're even; nil before the first
  /// levels or when two lead together.
  var leadingSkill: String? {
    let sorted = levels.sorted { $0.score > $1.score }

    guard let first = sorted.first else {
      return nil
    }

    let rest = sorted.dropFirst()

    if rest.allSatisfy({ $0.score == first.score }) {
      return String(
        localized: "Even across skills", table: "Plan", comment: "No language skill leads")
    }

    return rest.first?.score == first.score
      ? nil
      : String(
        localized: "\(languageSkillName(first.skill)) leads", table: "Plan",
        comment: "The language skill ahead of the others")
  }

  /// "A2+ → B1+": the level now and the one the goal aims for.
  var levelText: String {
    let now =
      level
      ?? String(localized: "Not yet", table: "Plan", comment: "A language level not measured yet")
    return target.map { "\(now) → \($0.label)" } ?? now
  }
}

/// "Your level": each skill's level.
struct LanguageLevelSheet: View {
  let standing: LanguageStanding

  var body: some View {
    List {
      Section {
        LabeledContent {
          Text(standing.levelText)
        } label: {
          Text("Level", tableName: "Plan", comment: "Label of a language goal's level")
        }
      }

      Section {
        ForEach(standing.levels, id: \.skill) { level in
          LabeledContent {
            Text(level.label)
          } label: {
            Text(languageSkillName(level.skill))
          }
        }
      }
    }
    .navigationTitle(
      Text("Your level", tableName: "Plan", comment: "Title of the language level sheet")
    )
    .toolbarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .confirmationAction) {
        PlanSheetDoneButton()
      }
    }
  }
}

/// The alphabet lesson of a script that isn't Latin, first on the path and open as practice
/// anytime. While it still opens the learner's sessions, they can say they already read the script.
struct PlanAlphabetRow: View {
  @Environment(PlanStore.self) private var store
  @State private var failed = false
  @State private var isSkipping = false

  let alphabet: LanguageUnitsOverview.Alphabet
  let goalId: String

  var body: some View {
    let time = planDurationText(minutes: Double(alphabet.minutes))

    PlanRouteLink(route: .lesson(lessonId: alphabet.lessonId)) {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          Text(alphabet.title)
          Group {
            if alphabet.pending {
              Text(
                "First in your next session · \(time)", tableName: "Plan",
                comment: "The alphabet lesson opens the next session")
            } else {
              Text(
                "Practice anytime · \(time)", tableName: "Plan",
                comment: "The alphabet lesson can be practiced anytime")
            }
          }
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      } icon: {
        Image(systemName: "character.book.closed")
      }
    }

    if alphabet.pending {
      Button {
        Task { await skip() }
      } label: {
        Text("I can already read it", tableName: "Plan", comment: "Skips the alphabet lesson")
      }
      .disabled(isSkipping)

      if failed {
        Text(
          "That didn't work. Try again in a moment.", tableName: "Plan",
          comment: "Says skipping the alphabet failed"
        )
        .foregroundStyle(.destructive)
      }
    }
  }

  private func skip() async {
    isSkipping = true
    failed = !(await store.skipAlphabet(goalId: goalId))
    isSkipping = false
  }
}
