import SwiftUI

/// Plus features are never hidden: free learners and guests see them with this mark, and they open
/// as usual to a screen whose `PlusNotice` says what Plus unlocks.
struct PlusMark: View {
  var accessibilityLabel: Text?

  var body: some View {
    Text(
      "Plus", tableName: "Subscriptions", comment: "Mark on a feature that comes with Zoonk Plus"
    )
    .chip()
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      accessibilityLabel
        ?? Text(
          "Available with Plus",
          tableName: "Subscriptions",
          comment: "What VoiceOver says for the Plus mark on a feature the learner's plan lacks"))
  }
}

/// At most one on a screen, inline where the locked things are, never a pop-up.
///
/// - `title` replaces "Available with Plus" where something the free plan had ends (a free exam
///   plan's first week).
/// - `showsSeePlus: false` drops the button where the screen's main action already is
///   `SeePlusButton`.
/// - `isInset` drops the panel inside a `List` row or a card that already has one.
/// - `action` is the free way, after "See Plus" (the free plan's one goal: their Plan).
struct PlusNotice<Action: View>: View {
  var title: Text?
  var description: Text?
  var showsSeePlus = true
  var isInset = false
  @ViewBuilder var action: Action

  var body: some View {
    if isInset {
      content
    } else {
      GroupBox {
        content
      }
    }
  }

  private var content: some View {
    Label {
      VStack(alignment: .leading, spacing: 4) {
        (title
          ?? Text(
            "Available with Plus",
            tableName: "Subscriptions",
            comment: "Title of the notice on a feature the learner's plan doesn't include"))
          .font(.headline)

        if let description {
          description
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        if showsSeePlus {
          HStack {
            SeePlusButton()
            action
          }
          .buttonStyle(.bordered)
          .controlSize(.small)
          .padding(.top, 8)
        }
      }
    } icon: {
      Image(systemName: "sparkles")
        .foregroundStyle(.secondary)
    }
  }
}

extension PlusNotice where Action == EmptyView {
  init(
    title: Text? = nil, description: Text? = nil, showsSeePlus: Bool = true, isInset: Bool = false
  ) {
    self.init(
      title: title, description: description, showsSeePlus: showsSeePlus, isInset: isInset
    ) {
      EmptyView()
    }
  }
}

struct SeePlusButton: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    Button {
      router.present(.subscription)
    } label: {
      Text("See Plus", tableName: "Subscriptions", comment: "Opens the Zoonk Plus subscription")
    }
  }
}

#Preview {
  List {
    Section {
      LabeledContent {
        PlusMark()
      } label: {
        Text(verbatim: "Mock exams")
      }

      PlusNotice(description: Text(verbatim: "Mock exams, timed like the real one"), isInset: true)
    }

    PlusNotice(description: Text(verbatim: "Your whole exam plan, every day to the exam"))
      .listRowInsets(EdgeInsets())
  }
  .environment(AppRouter())
}
