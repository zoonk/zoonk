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
/// - `seePlus` replaces opening Plus where the screen must close first (a full-screen moment).
/// - `action` is the free way, after "See Plus" (the free plan's one goal: their Plan).
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
    Label {
      VStack(alignment: .leading, spacing: 4) {
        (title
          ?? Text(
            "Available with Plus",
            tableName: "Subscriptions",
            comment: "Title of the notice on a feature the learner's plan doesn't include"))
          .typeStyle(.body.weight(.semibold))

        if let description {
          description
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        if showsSeePlus {
          HStack {
            SeePlusButton(action: seePlus)
            action
          }
          .buttonStyle(.outline)
          .controlSize(.small)
          .padding(.top, 8)
        }
      }
    } icon: {
      Image(systemName: "sparkles")
        .foregroundStyle(.mutedForeground)
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

struct FreeWeekOverNotice: View {
  static let title = LocalizedStringResource(
    "Your free week of exam prep is over", table: "Subscriptions",
    comment: "Title of the notice when a free exam plan's first week ended")
  static let description = LocalizedStringResource(
    "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.",
    table: "Subscriptions",
    comment: "What stays free and what Plus opens once a free exam plan's first week ended")

  var showsSeePlus = true
  var isInset = false

  var body: some View {
    PlusNotice(
      title: Text(Self.title), description: Text(Self.description), showsSeePlus: showsSeePlus,
      isInset: isInset)
  }
}

struct SeePlusButton: View {
  @Environment(AppRouter.self) private var router

  /// Replaces opening Plus here.
  var action: (() -> Void)?

  var body: some View {
    Button {
      if let action {
        action()
      } else {
        router.present(.subscription)
      }
    } label: {
      Text(
        "See Plus", tableName: "Subscriptions",
        comment: "Opens the Zoonk Plus subscription; Plus is its name, not \"more\"")
    }
  }
}

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

    PlusNotice(description: Text(verbatim: "Your whole exam plan, every day to the exam"))
      .listRowInsets(.vertical, 0)
  }
  .environment(AppRouter())
}
