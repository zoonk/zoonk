import SwiftUI

/// The buddy's conversation about what the learner is on, in a sheet or an inspector: the buddy
/// by name, what it's about, the question quoted when it's a practice question, and a close
/// button. Hosts that present it themselves (the player's inspector) return it from their hook;
/// others use `TutorAskButton`.
struct TutorPanel: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var summary

  let scope: TutorScope
  /// The practice question asked about, quoted so it stays in view.
  var quote: String?

  var body: some View {
    NavigationStack {
      TutorThreadView(scope: scope) {
        VStack(alignment: .leading, spacing: 8) {
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
      .navigationTitle(
        Text(
          "Ask \(name)", tableName: "Tutor",
          comment: "Title of the buddy's panel; the argument is the buddy's name")
      )
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

    Button {
      isPresented = true
    } label: {
      Label {
        Text(
          "Ask \(name)", tableName: "Tutor",
          comment: "Opens the buddy's panel; the argument is the buddy's name")
      } icon: {
        BuddyFace(kind: summary.summary.value?.buddyKind ?? .zu)
      }
    }
    .buttonStyle(.bordered)
    .accessibilityLabel(Text(scope.askLabel(name)))
    .sheet(isPresented: $isPresented) {
      TutorPanel(scope: scope, quote: quote)
    }
  }
}
