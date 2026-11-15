import SwiftUI

/// Hosts that place it themselves (the player) return it from their hook; others use
/// `TutorAskButton`.
struct TutorPanel: View {
  @Environment(\.dismiss) private var dismiss
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
          .navigationTitle(title)
          .navigationBarTitleDisplayMode(.inline)
          .sheetClose { dismiss() }
      }
      .zoonkStyles()
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
    TutorThreadView(scope: scope, draft: draft) {
      VStack(alignment: .leading, spacing: 8) {
        if showsBuddy {
          BuddyFigure(look: summary.summary.value?.buddy ?? BuddyLook())
            .padding(.bottom, 4)
            .accessibilityHidden(true)
        }

        if isPane {
          title
            .typeStyle(.body.weight(.semibold))
            .accessibilityAddTraits(.isHeader)
        }

        scope.panelDescription
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)

        if let quote {
          Text(quoteLine(quote))
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
            .lineLimit(3)
            .padding(.leading, 10)
            .overlay(alignment: .leading) {
              Rectangle()
                .fill(.border)
                .frame(width: 2)
            }
        }
      }
    }
  }

  private var name: String {
    summary.buddyDisplayName
  }

  /// Main's E-020: inside a lesson, the whole buddy greets an empty conversation.
  private var showsBuddy: Bool {
    switch scope {
    case .step, .lesson: tutor.conversation(scope).turns.isEmpty
    default: false
    }
  }

  private func quoteLine(_ question: String) -> String {
    if case .item(_, _, true, _, _) = scope {
      return String(
        localized: "About your answer to “\(question)”", table: "Tutor",
        comment: "The checked practice question the panel is about")
    }

    return String(
      localized: "About “\(question)”", table: "Tutor",
      comment: "The practice question the panel is about")
  }
}

struct TutorAskToolbarItem: ToolbarContent {
  let scope: TutorScope

  var body: some ToolbarContent {
    ToolbarItem(placement: .primaryAction) {
      TutorAskButton(scope: scope)
    }
  }
}

/// After a missed answer it says the buddy's name, when asking helps most.
struct TutorAskButton: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var summary

  let scope: TutorScope
  var quote: String?
  var iconOnly = false

  var body: some View {
    // The router presents the panel over the screen: the button can sit in a pane or a bar that a
    // resize draws again, and the panel stays.
    let button = Button {
      router.present(.tutor(scope, quote: quote))
    } label: {
      TutorAskLabel()
    }

    Group {
      // Beside a question's Check it's the buddy's face alone, so the bar keeps room for its
      // actions, until a miss, as main's bar does.
      if iconOnly {
        button.tutorAskIcon()
      } else if case .item(_, _, _, missed: false, mistakeId: _) = scope {
        button.tutorAskIcon()
      } else {
        button.buttonStyle(.outline)
      }
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
  /// The ask-the-buddy button beside a screen's main action: main's 44pt outline square with the
  /// buddy's face, as tall as the action beside it.
  func tutorAskIcon() -> some View {
    labelStyle(.iconOnly)
      .buttonStyle(.outline.icon)
      .controlSize(.large)
  }
}
