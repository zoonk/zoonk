import SwiftUI

/// The mark a choice ends with, the same in choice lists and answer options: a ring where one
/// choice is picked, a square where several are, both filled in ink with a check once picked. Its
/// shape says which before any tap. The row is the control, so the mark is unspoken.
struct ChoiceMark: View {
  enum Kind {
    case one
    case several
  }

  let kind: Kind
  let isPicked: Bool

  @Environment(\.colorSchemeContrast) private var contrast

  /// An empty mark is soft, and as dark as a picked one only when the device asks for more contrast.
  var body: some View {
    Image(systemName: symbol)
      .foregroundStyle(Color(.foreground).opacity(isPicked || contrast == .increased ? 1 : 0.5))
      .accessibilityHidden(true)
  }

  private var symbol: String {
    switch kind {
    case .one: isPicked ? "checkmark.circle.fill" : "circle"
    case .several: isPicked ? "checkmark.square.fill" : "square"
    }
  }
}

extension View {
  /// A choice VoiceOver reads as a pick of its list: picking several, a toggle that's on or off,
  /// as a checkbox is; picking one, selected.
  func choiceTraits(_ kind: ChoiceMark.Kind, isPicked: Bool) -> some View {
    accessibilityAddTraits(kind == .several ? .isToggle : [])
      .accessibilityAddTraits(isPicked ? .isSelected : [])
  }
}
