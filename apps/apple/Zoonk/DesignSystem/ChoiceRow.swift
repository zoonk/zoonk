import SwiftUI

/// Main's `ChoiceList` row: one of a few choices to pick. Its words, then a ring at the row's end
/// that fills with a check once picked, the picked row on the pick's tint, so the rows read as
/// choices before any is picked. What a pick leads to is the screen's action, in its bar. For
/// `ZoonkList`'s rows.
struct ChoiceRow<Words: View>: View {
  let isPicked: Bool
  /// A choice the learner can't pick yet shows a lock where its ring would be.
  var isLocked = false
  let action: () -> Void
  @ViewBuilder let words: Words

  var body: some View {
    Button(action: action) {
      ChoiceRowLabel(isPicked: isPicked, isLocked: isLocked) {
        words
      }
    }
    .disabled(isLocked)
    .pickedRow(isPicked)
    .accessibilityAddTraits(isPicked ? .isSelected : [])
  }
}

extension ChoiceRow where Words == ChoiceWords {
  init(_ title: Text, detail: Text? = nil, isPicked: Bool, action: @escaping () -> Void) {
    self.init(isPicked: isPicked, action: action) {
      ChoiceWords(title: title, detail: detail)
    }
  }
}

/// A choice row's label, for a row whose button is its own, such as one that shows it's saving.
struct ChoiceRowLabel<Words: View>: View {
  let isPicked: Bool
  var isLocked = false
  @ViewBuilder let words: Words

  var body: some View {
    HStack(spacing: 12) {
      words
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)

      Image(systemName: isLocked ? "lock" : isPicked ? "checkmark.circle.fill" : "circle")
        .foregroundStyle(
          isLocked
            ? AnyShapeStyle(.mutedForeground)
            : AnyShapeStyle(Color(.foreground).opacity(isPicked ? 1 : 0.5))
        )
        .accessibilityHidden(true)
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
    }
  }
}
