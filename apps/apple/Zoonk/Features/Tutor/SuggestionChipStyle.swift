import SwiftUI

/// A question or an example sent or filled in with one tap: a quiet capsule on the system's
/// tertiary fill, which reads on whatever the conversation sits on (a page, a sheet, an inspector)
/// in light, dark and Increase Contrast. `.bordered` blends its fill into a sheet's background.
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
      .foregroundStyle(isEnabled ? .primary : .secondary)
      .padding(.horizontal, 14)
      .padding(.vertical, 10)
      .background(Color(.tertiarySystemFill), in: .capsule)
      .opacity(configuration.isPressed ? 0.6 : 1)
      .contentShape(.capsule)
  }
}
