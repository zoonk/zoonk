import SwiftUI

/// Main's `ChoiceList` row, or its `CheckList` row where several can be picked: one of a few choices
/// to pick. Its words, then its `ChoiceMark`, the picked row on the pick's tint, so the rows read as
/// choices before any is picked. What a pick leads to is the screen's action, in its bar. For
/// `ZoonkList`'s rows.
struct ChoiceRow<Words: View>: View {
  var picks: ChoiceMark.Kind = .one
  let isPicked: Bool
  /// A choice the learner can't pick yet shows a lock where its ring would be.
  var isLocked = false
  let action: () -> Void
  @ViewBuilder let words: Words

  var body: some View {
    Button(action: action) {
      ChoiceRowLabel(picks: picks, isPicked: isPicked, isLocked: isLocked) {
        words
      }
    }
    .disabled(isLocked)
    .pickedRow(isPicked)
    .choiceTraits(picks, isPicked: isPicked)
  }
}

extension ChoiceRow where Words == ChoiceWords {
  init(
    _ title: Text, detail: Text? = nil, picks: ChoiceMark.Kind = .one, isPicked: Bool,
    action: @escaping () -> Void
  ) {
    self.init(picks: picks, isPicked: isPicked, action: action) {
      ChoiceWords(title: title, detail: detail)
    }
  }
}

/// A choice row's label, for a row whose button is its own, such as one that shows it's saving.
struct ChoiceRowLabel<Words: View>: View {
  var picks: ChoiceMark.Kind = .one
  let isPicked: Bool
  var isLocked = false
  @ViewBuilder let words: Words

  var body: some View {
    HStack(spacing: 12) {
      words
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)

      Group {
        if isLocked {
          Image(systemName: "lock")
            .foregroundStyle(.mutedForeground)
            .accessibilityHidden(true)
        } else {
          ChoiceMark(kind: picks, isPicked: isPicked)
        }
      }
      .layoutPart(.end)
    }
    .contentShape(.rect)
    .layoutRow(.choiceList)
  }
}

/// A choice's name over at most one line about it.
struct ChoiceWords: View {
  let title: Text
  var detail: Text?
  /// Why the choice can't be taken now, under its detail.
  var note: Text?

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      title
        .layoutPart(.label, text: title)
        .typeStyle(.rowTitle)
        .foregroundStyle(Color(.foreground))

      if let detail {
        detail
          .layoutPart(.note, text: detail)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }

      if let note {
        note
          .layoutPart(.note, text: note)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
  }
}
