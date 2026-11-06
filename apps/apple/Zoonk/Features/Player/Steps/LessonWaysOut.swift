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
    .typeStyle(.body)
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
          .foregroundStyle(.mutedForeground)
        LessonRichText(line)
      }
      .padding(.leading, 12)
      .overlay(alignment: .leading) {
        Rectangle().fill(.border).frame(width: 2)
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
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)

      FlowLayout {
        ForEach(store.suggestionsBeside.prefix(2), id: \.id) { suggestion in
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
      .buttonStyle(.outline)
    }
    .accessibilityElement(children: .contain)
  }
}

/// After two misses in a row on the same idea, or a long pause on a language lesson's explanation.
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
        Text(Self.message(reason, buddyName: buddyName))
          .typeStyle(.body)

        ButtonRow {
          Button {
            store.ask(suggestionId: "simpler")
          } label: {
            askLabel
          }
          .buttonStyle(.outline)

          Button {
            isDismissed = true
          } label: {
            Text("No thanks", tableName: "Player", comment: "Puts away the offer to ask the buddy")
          }
          .buttonStyle(.borderless)
        }
        .typeStyle(.body)
      }
      .padding(.top, 12)
      .overlay(alignment: .top) { Divider() }
      .accessibilityElement(children: .contain)
    }
  }

  private var buddyName: String? {
    learnerSummary?.summary.value?.buddyDisplayName
  }

  static func message(_ reason: Reason, buddyName: String?) -> String {
    switch (reason, buddyName) {
    case (.misses, let name?):
      String(
        localized: "This one is tricky. \(name) can explain it another way.", table: "Player",
        comment: "Offer to ask the buddy after two misses")
    case (.misses, nil):
      String(
        localized: "This one is tricky. Your buddy can explain it another way.", table: "Player",
        comment: "Offer to ask the buddy after two misses")
    case (.pause, let name?):
      String(
        localized: "Taking your time? \(name) can explain it another way.", table: "Player",
        comment: "Offer to ask the buddy after a long pause")
    case (.pause, nil):
      String(
        localized: "Taking your time? Your buddy can explain it another way.", table: "Player",
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

extension View {
  /// Reads the offer out as it shows up, from a view that stays while it comes and goes.
  func announcesBuddyOffer(_ reason: LessonAskBuddyOffer.Reason, isShown: Bool) -> some View {
    modifier(BuddyOfferAnnouncement(reason: reason, isShown: isShown))
  }
}

private struct BuddyOfferAnnouncement: ViewModifier {
  @Environment(\.lessonTutor) private var tutor
  @Environment(LearnerSummaryStore.self) private var learnerSummary: LearnerSummaryStore?

  let reason: LessonAskBuddyOffer.Reason
  let isShown: Bool

  func body(content: Content) -> some View {
    content.announcesStatus(
      isShown && tutor.panel != nil
        ? LessonAskBuddyOffer.message(
          reason, buddyName: learnerSummary?.summary.value?.buddyDisplayName) : nil)
  }
}

struct LessonPauseOffer: View {
  @Environment(\.scenePhase) private var scenePhase
  @State private var isStuck = false

  let step: LessonStep
  let store: LessonPlayerStore

  private var isShown: Bool { isStuck && store.state?.quickCheck == nil }

  var body: some View {
    // A stack rather than a group, so the timer runs while nothing shows yet.
    VStack(alignment: .leading, spacing: 0) {
      if isShown {
        LessonAskBuddyOffer(reason: .pause, store: store)
      }
    }
    .announcesBuddyOffer(.pause, isShown: isShown)
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

    let words = WordCount.count(text)
    let readingSeconds = Double(words) / 150 * 60
    return .seconds(max(45, readingSeconds * 3))
  }
}

extension PlayableLesson {
  /// Every explanation and worked example of a knowledge lesson.
  func offersDidntGetIt(on step: LessonStep) -> Bool {
    step.isExplaining && targetLanguage == nil
  }
}

/// Learners who don't follow a screen rarely think to ask the buddy, so one tap asks for them: the
/// buddy's face beside their own words, as main's.
struct LessonDidntGetIt: View {
  @Environment(\.lessonTutor) private var tutor
  @Environment(LearnerSummaryStore.self) private var learnerSummary: LearnerSummaryStore?

  let store: LessonPlayerStore

  var body: some View {
    // A guest can't talk with the buddy yet: the tap would ask them to sign up instead.
    if tutor.panel != nil, !store.isGuest {
      let buddy = learnerSummary?.summary.value?.buddy ?? BuddyLook()

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
          BuddyFace(kind: buddy.kind, glasses: buddy.glasses)
        }
      }
      .buttonStyle(.borderless)
      .typeStyle(.smallButton)
      .foregroundStyle(.mutedForeground)
      .accessibilityHint(
        Text(
          "Your buddy explains this screen more simply", tableName: "Player",
          comment: "VoiceOver hint of the \"I didn't get this\" button under an explanation"))
    }
  }
}
