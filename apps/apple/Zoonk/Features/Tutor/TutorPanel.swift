import SwiftUI

/// The buddy's conversation about what the learner is on, in a sheet or a pane: the buddy by name,
/// what it's about, and the question quoted when it's a practice question. A sheet has its own bar
/// with a close button; a pane beside the screen has neither, since the screen's bar is the only
/// bar and its Ask closes the pane. Hosts that place it themselves (the player) return it from their
/// hook; others use `TutorAskButton`.
struct TutorPanel: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var summary

  let scope: TutorScope
  /// The practice question asked about, quoted so it stays in view.
  var quote: String?
  /// Beside the screen rather than in a sheet.
  var isPane = false

  var body: some View {
    if isPane {
      thread
    } else {
      NavigationStack {
        thread
          .navigationTitle(title)
          .navigationBarTitleDisplayMode(.inline)
          .toolbar {
            ToolbarItem(placement: .cancellationAction) {
              Button(role: .close) {
                dismiss()
              }
            }
          }
      }
      .presentationDetents([.medium, .large])
      .presentationBackgroundInteraction(.enabled(upThrough: .medium))
    }
  }

  private var title: Text {
    Text(
      "Ask \(name)", tableName: "Tutor",
      comment: "Title of the buddy's panel; the argument is the buddy's name")
  }

  private var thread: some View {
    TutorThreadView(scope: scope) {
      VStack(alignment: .leading, spacing: 8) {
        if isPane {
          title
            .font(.headline)
            .accessibilityAddTraits(.isHeader)
        }

        scope.panelDescription
          .font(.subheadline)
          .foregroundStyle(.secondary)

        if let quote {
          Text(quoteLine(quote))
            .font(.footnote)
            .foregroundStyle(.secondary)
            .lineLimit(3)
            .padding(.leading, 10)
            .overlay(alignment: .leading) {
              Rectangle()
                .fill(.separator)
                .frame(width: 2)
            }
        }
      }
    }
  }

  private var name: String {
    summary.buddyDisplayName
  }

  private func quoteLine(_ question: String) -> String {
    if case .item(_, _, true, _) = scope {
      return String(
        localized: "About your answer to “\(question)”", table: "Tutor",
        comment: "The checked practice question the panel is about")
    }

    return String(
      localized: "About “\(question)”", table: "Tutor",
      comment: "The practice question the panel is about")
  }
}

/// "Ask Zu": the learner's buddy answers about what the screen shows, in its panel as a sheet.
/// After a missed answer it says the buddy's name, when asking helps most.
struct TutorAskButton: View {
  @Environment(LearnerSummaryStore.self) private var summary

  let scope: TutorScope
  var quote: String?

  @State private var isPresented = false

  var body: some View {
    let name = summary.buddyDisplayName
    let button = Button {
      isPresented = true
    } label: {
      Label {
        Text(
          "Ask \(name)", tableName: "Tutor",
          comment: "Opens the buddy's panel; the argument is the buddy's name")
      } icon: {
        let buddy = summary.summary.value?.buddy ?? BuddyLook()
        BuddyFace(kind: buddy.kind, glasses: buddy.glasses)
      }
    }

    Group {
      // Beside a question's Check it's the buddy's face alone, so the bar keeps room for its
      // actions, until a miss, as main's bar does.
      if case .item(_, _, _, missed: false) = scope {
        button.labelStyle(.iconOnly)
      } else {
        button
      }
    }
    .buttonStyle(.bordered)
    .accessibilityLabel(Text(scope.askLabel(name)))
    .sheet(isPresented: $isPresented) {
      TutorPanel(scope: scope, quote: quote)
    }
  }
}
