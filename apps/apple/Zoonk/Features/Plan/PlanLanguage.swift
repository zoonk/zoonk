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
  /// "English level": "Level" alone is the game's.
  var levelTitle: String {
    String(
      localized: "\(Locale.current.languageName(goal.targetLanguage)) level", table: "Plan")
  }

  var sheetTitle: String {
    String(
      localized: "Your \(Locale.current.languageName(goal.targetLanguage)) level", table: "Plan")
  }

  func levelText(ranges: [String]? = nil) -> String {
    if let ranges {
      return ranges.isEmpty ? noLevelYet : ranges.joined(separator: "\n")
    }

    guard let level else { return noLevelYet }

    return level.target.map { "\(level.label) → \($0)" } ?? level.label
  }

  /// Main's `LevelValue`, for a readout: the level reached, then the one aimed for, smaller and
  /// muted.
  func levelValue(
    dynamicTypeSize: DynamicTypeSize, legibility: LegibilityWeight?
  ) -> Text {
    guard let level, let target = level.target else { return Text(verbatim: levelText()) }

    var environment = EnvironmentValues()
    environment.dynamicTypeSize = dynamicTypeSize
    environment.legibilityWeight = legibility
    let aim = Text(verbatim: " → \(target)")
      .font(TypeStyle.readoutTarget.font(in: environment))
      .foregroundStyle(.mutedForeground)

    return Text("\(Text(verbatim: level.label))\(aim)")
  }

  private var noLevelYet: String {
    String(localized: "Not yet", table: "Plan", comment: "A language level not measured yet")
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
  @Environment(\.dismiss) private var dismiss
  let standing: LanguageStanding
  let assessment: PlacementTestResult?

  var body: some View {
    let ranges = assessment.map { PlacementTestCopy.rangeFacts($0.skillRanges) }
    ZoonkList {
      Section {
        LabeledContent {
          Text(standing.levelText(ranges: ranges))
        } label: {
          Text(standing.levelTitle)
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
      }
    }
    .navigationTitle(Text(standing.sheetTitle))
    .toolbarTitleDisplayMode(.inline)
    .sheetClose { dismiss() }
  }
}

struct PlanAlphabetRow: View {
  @Environment(PlanStore.self) private var store

  let alphabet: LanguageUnitsOverview.Alphabet
  let goalId: String
  /// The Plan's, above its panes.
  let skip: VisitRequest<Bool>

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
        skipAlphabet()
      } label: {
        Text(
          "I can already read it", tableName: "Plan",
          comment: "Skips the alphabet lesson; \"it\" is the language's alphabet")
      }
      .disabled(skip.isRunning)

      if skip.outcome == false {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't work. Try again in a moment.", table: "Plan",
            comment: "Says skipping the alphabet failed"))
      }
    }
  }

  private func skipAlphabet() {
    skip.run { [store, goalId] in
      switch await store.skipAlphabet(goalId: goalId) {
      case .done(let skipped): skipped
      case .failed: false
      case .obsolete: nil
      }
    }
  }
}
