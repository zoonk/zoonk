import SwiftUI

/// The tertiary fill reads on a page, a sheet or a pane; `.bordered` blends its fill into a
/// sheet's background.
struct SuggestionChipStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    SuggestionChip(configuration: configuration)
  }
}

extension ButtonStyle where Self == SuggestionChipStyle {
  static var suggestionChip: SuggestionChipStyle { SuggestionChipStyle() }
}

private struct SuggestionChip: View {
  @Environment(\.isEnabled) private var isEnabled

  let configuration: ButtonStyleConfiguration

  var body: some View {
    configuration.label
      .foregroundStyle(isEnabled ? Color(.foreground) : .mutedForeground)
      .padding(.horizontal, 14)
      .padding(.vertical, 10)
      .background(Color.muted, in: .capsule)
      .opacity(configuration.isPressed ? 0.6 : 1)
      // The capsule hugs the label; pressing reaches Apple's 44-point minimum around it.
      .frame(minHeight: 44)
      .contentShape(.capsule)
  }
}
