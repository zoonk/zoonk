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
              comment: "Shows the explanation before answering")
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
              Text(
                "I don't know yet", tableName: "Player",
                comment: "Shows a good answer to a written question")
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
          "Your example: \(line)", tableName: "Player",
          comment: "VoiceOver label of the learner's personal example"))
    }
  }
}

/// After two misses in a row on the same idea, or a long pause on an explanation.
struct LessonAskBuddyOffer: View {
  enum Reason {
    case misses, pause
  }

  @Environment(\.lessonTutor) private var tutor
  @Environment(LearnerSummaryStore.self) private var learnerSummary: LearnerSummaryStore?
  @State private var isDismissed = false

  let reason: Reason
  let store: LessonPlayerStore

  var body: some View {
    if tutor.panel != nil, !isDismissed {
      VStack(alignment: .leading, spacing: 8) {
        message
          .font(.subheadline)

        HStack {
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
    switch (reason, buddyName) {
    case (.misses, let name?):
      Text(
        "This one is tricky. \(name) can explain it another way.", tableName: "Player",
        comment: "Offer to ask the buddy after two misses")
    case (.misses, nil):
      Text(
        "This one is tricky. Your buddy can explain it another way.", tableName: "Player",
        comment: "Offer to ask the buddy after two misses")
    case (.pause, let name?):
      Text(
        "Taking your time? \(name) can explain it another way.", tableName: "Player",
        comment: "Offer to ask the buddy after a long pause")
    case (.pause, nil):
      Text(
        "Taking your time? Your buddy can explain it another way.", tableName: "Player",
        comment: "Offer to ask the buddy after a long pause")
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

struct LessonPauseOffer: View {
  @Environment(\.scenePhase) private var scenePhase
  @State private var isStuck = false

  let step: LessonStep
  let store: LessonPlayerStore

  var body: some View {
    // A stack rather than a group, so the timer runs while nothing shows yet.
    VStack(alignment: .leading, spacing: 0) {
      if isStuck, store.state?.quickCheck == nil {
        LessonAskBuddyOffer(reason: .pause, store: store)
      }
    }
    .task(id: PauseKey(stepId: step.id, isActive: scenePhase == .active, touches: store.touches)) {
      guard !isStuck, scenePhase == .active, let delay = step.strugglePause else {
        return
      }

      try? await Task.sleep(for: delay)

      if !Task.isCancelled {
        isStuck = true
      }
    }
  }

  private struct PauseKey: Hashable {
    let stepId: String
    let isActive: Bool
    let touches: Int
  }
}

extension LessonStep {
  /// How long a learner can stay on an explanation or worked example without touching anything
  /// before help is offered: three times its reading time at 150 words a minute, at least 45 s.
  var strugglePause: Duration? {
    let text: String

    switch content {
    case .explanation(let content):
      text = "\(content.title ?? "") \(content.text)"
    case .workedExample(let content):
      text = ([content.problem] + content.steps.map(\.text) + [content.result]).joined(
        separator: " ")
    default:
      return nil
    }

    let words = text.split(whereSeparator: \.isWhitespace).count
    let readingSeconds = Double(words) / 150 * 60
    return .seconds(max(45, readingSeconds * 3))
  }
}
