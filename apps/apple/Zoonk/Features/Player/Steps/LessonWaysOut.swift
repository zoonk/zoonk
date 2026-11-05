import SwiftUI

struct LessonWaysOut: View {
  let state: LessonPlayerState
  let store: LessonPlayerStore
  let step: LessonStep

  var body: some View {
    let isLocked = state.phase != .playing
    let isWriting = step.isWriting

    VStack(alignment: .leading, spacing: 4) {
      if state.canExplainFirst {
        Button {
          store.explainFirst()
        } label: {
          Label {
            Text(
              "Explain first", tableName: "Player",
              comment:
                "Asks Zoonk to show the explanation before the learner answers; the learner doesn't explain"
            )
          } icon: {
            Image(systemName: "book")
          }
        }
      }

      if isWriting, !isLocked {
        if !state.canExplainFirst {
          Button {
            store.dontKnow()
          } label: {
            Label {
              Text(Self.dontKnowTitle)
            } icon: {
              Image(systemName: "questionmark.circle")
            }
          }
        }

        Button {
          store.skipWriting()
        } label: {
          Label {
            Text(
              "Can't write now", tableName: "Player",
              comment: "Leaves writing out for the rest of today")
          } icon: {
            Image(systemName: "pencil.slash")
          }
        }
      }
    }
    .buttonStyle(.borderless)
    .font(.subheadline)
  }

  static let dontKnowTitle = LocalizedStringResource(
    "I don't know yet", table: "Player",
    comment:
      "Reveals the answer: a good answer to a written question, or the answer to the lesson's opening guess"
  )
}

struct LessonExampleLine: View {
  let line: String?

  var body: some View {
    if let line {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        Image(systemName: "person")
          .foregroundStyle(.secondary)
        LessonRichText(line)
      }
      .padding(.leading, 12)
      .overlay(alignment: .leading) {
        Rectangle().fill(.separator).frame(width: 2)
      }
      .accessibilityElement(children: .combine)
      .accessibilityLabel(
        Text(
          "Your example: \(LessonRichText.spoken(line))", tableName: "Player",
          comment: "VoiceOver label of the learner's personal example"))
    }
  }
}

/// Help with a teaching screen on the learner's page of a spread, as main's aside offers it beside
/// one on wide screens: two of the buddy's suggestions for the screen, or anything else.
struct LessonScreenHelp: View {
  @Environment(LearnerSummaryStore.self) private var learnerSummary

  let store: LessonPlayerStore

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Label {
        Text(
          "Ask \(learnerSummary.buddyDisplayName) about this screen", tableName: "Player",
          comment: "Above the buddy's suggestions beside a teaching screen")
      } icon: {
        Image(systemName: "bubble.left.and.text.bubble.right")
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)

      FlowLayout {
        ForEach((store.lesson?.tutorSuggestions ?? []).prefix(2), id: \.id) { suggestion in
          Button {
            store.ask(suggestionId: suggestion.id.rawValue)
          } label: {
            Text(suggestion.label)
          }
        }

        Button {
          store.ask()
        } label: {
          Text(
            "Ask something else", tableName: "Player",
            comment: "Opens the buddy to ask about the screen in the learner's own words")
        }
      }
      .buttonStyle(.suggestionChip)
      .font(.subheadline)
    }
    .accessibilityElement(children: .contain)
  }
}

/// After two misses in a row on the same idea.
struct LessonAskBuddyOffer: View {
  @Environment(\.lessonTutor) private var tutor
  @Environment(LearnerSummaryStore.self) private var learnerSummary: LearnerSummaryStore?
  @State private var isDismissed = false

  let store: LessonPlayerStore

  var body: some View {
    if tutor.panel != nil, !isDismissed {
      VStack(alignment: .leading, spacing: 8) {
        message
          .font(.subheadline)

        ButtonRow {
          Button {
            store.ask(suggestionId: "simpler")
          } label: {
            askLabel
          }
          .buttonStyle(.bordered)

          Button {
            isDismissed = true
          } label: {
            Text("No thanks", tableName: "Player", comment: "Puts away the offer to ask the buddy")
          }
          .buttonStyle(.borderless)
        }
        .font(.subheadline)
      }
      .padding(.top, 12)
      .overlay(alignment: .top) { Divider() }
      .accessibilityElement(children: .contain)
    }
  }

  private var buddyName: String? {
    learnerSummary?.summary.value?.buddyDisplayName
  }

  @ViewBuilder
  private var message: some View {
    if let buddyName {
      Text(
        "This one is tricky. \(buddyName) can explain it another way.", tableName: "Player",
        comment: "Offer to ask the buddy after two misses")
    } else {
      Text(
        "This one is tricky. Your buddy can explain it another way.", tableName: "Player",
        comment: "Offer to ask the buddy after two misses")
    }
  }

  @ViewBuilder
  private var askLabel: some View {
    if let buddyName {
      Text("Ask \(buddyName)", tableName: "Player", comment: "Opens the Ask panel with the buddy")
    } else {
      Text("Ask your buddy", tableName: "Player", comment: "Opens the Ask panel with the buddy")
    }
  }
}

/// Learners who don't follow a screen rarely think to ask the buddy, so one tap asks for them.
struct LessonDidntGetIt: View {
  @Environment(\.lessonTutor) private var tutor

  let store: LessonPlayerStore

  var body: some View {
    if tutor.panel != nil {
      Button {
        store.ask(suggestionId: "simpler", sendsAtOnce: true)
      } label: {
        Label {
          Text(
            "I didn't get this", tableName: "Player",
            comment:
              "Quiet button under a lesson's explanation, in the learner's own voice: what they'd say when the screen lost them (\"Não entendi\" in Portuguese). Tapping it has the buddy explain the screen more simply."
          )
        } icon: {
          Image(systemName: "questionmark.bubble")
        }
      }
      .buttonStyle(.borderless)
      .font(.subheadline)
      .foregroundStyle(.secondary)
      .accessibilityHint(
        Text(
          "Your buddy explains this screen more simply", tableName: "Player",
          comment: "VoiceOver hint of the \"I didn't get this\" button under an explanation"))
    }
  }
}

extension LessonStep {
  var isExplained: Bool {
    switch content {
    case .explanation, .workedExample: true
    default: false
    }
  }
}
