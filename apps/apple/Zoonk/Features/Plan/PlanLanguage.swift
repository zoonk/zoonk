import SwiftUI

func languageSkillName(_ skill: String) -> String {
  switch skill {
  case "reading": String(localized: "Reading", table: "Plan", comment: "A language skill")
  case "listening": String(localized: "Listening", table: "Plan", comment: "A language skill")
  case "speaking": String(localized: "Speaking", table: "Plan", comment: "A language skill")
  default: String(localized: "Writing", table: "Plan", comment: "A language skill")
  }
}

extension LanguageStanding {
  var levelText: String {
    guard let level else {
      return String(
        localized: "Not yet", table: "Plan", comment: "A language level not measured yet")
    }

    return level.target.map { "\(level.label) → \($0)" } ?? level.label
  }
}

extension LanguageStanding.Level {
  /// One sentence per skill, since a skill's name can't be dropped into a sentence in every
  /// language.
  fileprivate var estimate: String {
    switch skill {
    case "reading":
      String(
        localized: "Estimated reading level: \(label)", table: "Plan",
        comment: "What VoiceOver says for a skill's row; the argument is a CEFR level, such as B2")
    case "listening":
      String(
        localized: "Estimated listening level: \(label)", table: "Plan",
        comment: "What VoiceOver says for a skill's row; the argument is a CEFR level, such as B2")
    case "speaking":
      String(
        localized: "Estimated speaking level: \(label)", table: "Plan",
        comment: "What VoiceOver says for a skill's row; the argument is a CEFR level, such as B2")
    default:
      String(
        localized: "Estimated writing level: \(label)", table: "Plan",
        comment: "What VoiceOver says for a skill's row; the argument is a CEFR level, such as B2")
    }
  }
}

struct LanguageLevelSheet: View {
  let standing: LanguageStanding

  var body: some View {
    ZoonkList {
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
          .accessibilityRepresentation { Text(level.estimate) }
        }
      } header: {
        SectionTitle(
          Text(
            "Practice estimates", tableName: "Plan",
            comment:
              "Heads each language skill's level, estimated from the learner's answers to set how hard practice is"
          ))
      } footer: {
        SectionFooter {
          Text(
            "These estimates guide practice difficulty. Certificates follow the lessons completed in your plan.",
            tableName: "Plan",
            comment:
              "Under the skill estimates: they set how hard practice is, while certificates come from finishing the plan's lessons"
          )
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
                "First in your next session\u{00A0}· \(time)", tableName: "Plan",
                comment: "The alphabet lesson opens the next session")
            } else {
              Text(
                "Practice anytime\u{00A0}· \(time)", tableName: "Plan",
                comment: "The alphabet lesson can be practiced anytime")
            }
          }
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
      } icon: {
        Image(systemName: "character.book.closed")
      }
    }

    if alphabet.pending {
      Button {
        Task { await skip() }
      } label: {
        Text(
          "I can already read it", tableName: "Plan",
          comment: "Skips the alphabet lesson; \"it\" is the language's alphabet")
      }
      .disabled(isSkipping)

      if failed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't work. Try again in a moment.", table: "Plan",
            comment: "Says skipping the alphabet failed"))
      }
    }
  }

  private func skip() async {
    isSkipping = true
    switch await store.skipAlphabet(goalId: goalId) {
    case .done(let skipped): failed = !skipped
    case .failed: failed = true
    case .obsolete: break
    }
    isSkipping = false
  }
}
