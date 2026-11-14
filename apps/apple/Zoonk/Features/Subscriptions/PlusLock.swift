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

/// At most one on a screen, inline where the locked things are, never a pop-up. Main's
/// `PlusNotice`: a panel with the sparkle on its title's line, in a list too.
///
/// - `title` replaces "Available with Plus".
/// - `showsSeePlus: false` drops the button where the screen's main action already is
///   `SubscribeButton`, or where `action` is the only way forward (a guest's free account).
/// - `isInset` drops the panel inside a card that already has one (a tutor's offer).
/// - `seePlus` replaces opening Plus where the screen must close first (a full-screen moment).
/// - `action` is the free way, after "Subscribe" (a goal past the free plan's active goals: their Plan).
struct PlusNotice<Action: View>: View {
  var title: Text?
  var description: Text?
  var showsSeePlus = true
  var isInset = false
  var seePlus: (() -> Void)?
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
    MarkedRow {
      Image(systemName: "sparkles")
        .typeStyle(.rowTitle)
        .foregroundStyle(.mutedForeground)
        .accessibilityHidden(true)
    } content: {
      VStack(alignment: .leading, spacing: 2) {
        (title
          ?? Text(
            "Available with Plus",
            tableName: "Subscriptions",
            comment: "Title of the notice on a feature the learner's plan doesn't include"))
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))

        if let description {
          description
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        if showsSeePlus || Action.self != EmptyView.self {
          HStack {
            if showsSeePlus {
              SeePlusButton(action: seePlus)
            }
            action
          }
          .buttonStyle(.outline)
          .controlSize(.small)
          .padding(.top, 8)
        }
      }
    } end: {
      EmptyView()
    }
  }
}

extension PlusNotice where Action == EmptyView {
  init(
    title: Text? = nil, description: Text? = nil, showsSeePlus: Bool = true, isInset: Bool = false,
    seePlus: (() -> Void)? = nil
  ) {
    self.init(
      title: title, description: description, showsSeePlus: showsSeePlus, isInset: isInset,
      seePlus: seePlus
    ) {
      EmptyView()
    }
  }
}

/// Every action that leads to paying reads "Subscribe"; this name goes with `PlusNotice`.
typealias SeePlusButton = SubscribeButton

#Preview {
  ZoonkList {
    Section {
      LabeledContent {
        PlusMark()
      } label: {
        Text(verbatim: "Mock exams")
      }

      PlusNotice(description: Text(verbatim: "Mock exams, timed like the real one"), isInset: true)
    }

    Section {
      PlusNotice(description: Text(verbatim: "Your whole exam plan, every day to the exam"))
    }
    .listRowBackground(Color.clear)
    .listRowInsets(.vertical, 0)
  }
  .environment(AppRouter())
}
