import SwiftUI

/// Hosts that place it themselves (the player) return it from their hook; others use
/// `TutorAskButton`.
struct TutorPanel: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.legibilityWeight) private var legibilityWeight
  @Environment(LearnerSummaryStore.self) private var summary
  @Environment(TutorStore.self) private var tutor

  let scope: TutorScope
  var quote: String?
  var isPane = false
  /// Main's offer when the learner seems stuck: the suggestion waits in the composer.
  var draft: TutorDraft?

  var body: some View {
    if isPane {
      thread
    } else {
      NavigationStack {
        thread
          .navigationTitle(Text(verbatim: name))
          .navigationSubtitle(scope.panelDescription)
          .navigationBarTitleDisplayMode(.inline)
          .sheetClose { dismiss() }
      }
      .zoonkSheet()
      .presentationDetents([.medium, .large])
      .presentationBackgroundInteraction(.enabled(upThrough: .medium))
      .closesOnNavigation()
    }
  }

  private var title: Text {
    Text(
      "Ask \(name)", tableName: "Tutor",
      comment: "Title of the buddy's panel; the argument is the buddy's name")
  }

  private var thread: some View {
    // In a sheet the suggestions open the conversation, as main's do; beside a lesson they wait by
    // the composer, as main's side panel does.
    TutorThreadView(scope: scope, suggestions: isPane ? nil : [], draft: draft) {
      if isPane {
        VStack(alignment: .leading, spacing: 8) {
          title
            .typeStyle(.body.weight(.semibold))
            .accessibilityAddTraits(.isHeader)

          scope.panelDescription
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }

      if let quote {
        let question = LessonRichText.typeset(quote)

        quoteLine(question.quoted(spoken: false, legibility: legibilityWeight))
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .lineLimit(3)
          .accessibilityLabel(
            quoteLine(question.quoted(spoken: true, legibility: legibilityWeight))
          )
          .padding(.leading, 10)
          .overlay(alignment: .leading) {
            Rectangle()
              .fill(.border)
              .frame(width: 2)
          }
      }

      if conversation.turns.isEmpty, conversation.asking == nil {
        intro
      }
    }
  }

  private var intro: some View {
    VStack(alignment: .leading, spacing: 16) {
      VStack(alignment: .leading, spacing: 12) {
        BuddyFigure(look: summary.summary.value?.buddy ?? BuddyLook())
          .accessibilityHidden(true)

        Text("\(name) is an AI study buddy and can make mistakes.", tableName: "Tutor")
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }

      if !isPane {
        TutorSuggestionChips(conversation: conversation, suggestions: scope.suggestions)
      }
    }
  }

  private var conversation: TutorConversation {
    tutor.conversation(scope)
  }

  private var name: String {
    summary.buddyDisplayName
  }

  private func quoteLine(_ question: Text) -> Text {
    if case .item(_, _, true, _) = scope {
      return Text(
        "About your answer to “\(question)”", tableName: "Tutor",
        comment: "The checked practice question the panel is about")
    }

    return Text(
      "About “\(question)”", tableName: "Tutor",
      comment: "The practice question the panel is about")
  }
}

struct TutorAskToolbarItem: ToolbarContent {
  let scope: TutorScope

  var body: some ToolbarContent {
    ToolbarItem(placement: .primaryAction) {
      TutorAskButton(scope: scope)
        .buttonStyle(.outline)
    }
  }
}

/// Styled where it sits: `tutorAskIcon()` in a task's bar.
struct TutorAskButton: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var summary

  let scope: TutorScope
  var quote: String?

  var body: some View {
    // The router presents the panel over the screen: the button can sit in a pane or a bar that a
    // resize draws again, and the panel stays.
    Button {
      router.present(.tutor(scope, quote: quote))
    } label: {
      TutorAskLabel()
    }
    .accessibilityLabel(Text(scope.askLabel(summary.buddyDisplayName)))
  }
}

/// The one ask-the-buddy label: "Ask" and the buddy's name beside its face.
struct TutorAskLabel: View {
  @Environment(LearnerSummaryStore.self) private var summary

  var body: some View {
    Label {
      Text(
        "Ask \(summary.buddyDisplayName)", tableName: "Tutor",
        comment: "Opens the buddy's panel; the argument is the buddy's name")
    } icon: {
      let buddy = summary.summary.value?.buddy ?? BuddyLook()
      BuddyFace(kind: buddy.kind, glasses: buddy.glasses)
    }
  }
}

extension View {
  /// The ask-the-buddy button after a task's main action: main's 44pt outline square with the
  /// buddy's face, as tall as the action beside it, at every size.
  func tutorAskIcon() -> some View {
    labelStyle(.iconOnly)
      .buttonStyle(.outline.icon)
      .controlSize(.large)
  }
}
