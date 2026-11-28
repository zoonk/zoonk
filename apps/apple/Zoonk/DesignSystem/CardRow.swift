import SwiftUI

/// Main's card row (`CARD_ROW_CLASS`): a `ZoonkList` button row on a card of its own, on the pick's
/// tint once picked. The whole card dims while its list can't change, as while it saves. Give the
/// row `cardRowInList()`.
struct CardRowStyle: ButtonStyle {
  var isPicked = false

  func makeBody(configuration: Configuration) -> some View {
    CardRow(configuration: configuration, isPicked: isPicked)
  }
}

private struct CardRow: View {
  let configuration: ButtonStyleConfiguration
  let isPicked: Bool

  @Environment(\.isEnabled) private var isEnabled

  var body: some View {
    configuration.label
      .frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .panel(fill: fill)
      .contentShape(.rect(cornerRadius: Radius.xl, style: .continuous))
      .opacity(isEnabled ? 1 : 0.5)
  }

  private var fill: Color {
    if isPicked {
      return .selectedTint
    }

    return configuration.isPressed ? Color.muted.opacity(0.6) : .card
  }
}

extension View {
  /// A card row draws its own ground, with main's 8pt between cards in place of a hairline.
  func cardRowInList() -> some View {
    listRowBackground(Color.clear)
      .listRowSeparator(.hidden)
      .listRowInsets(.vertical, 4)
  }
}
