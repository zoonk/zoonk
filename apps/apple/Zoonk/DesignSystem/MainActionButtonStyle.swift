import SwiftUI

/// A screen's main action (main's default `Button`): the system's prominent button in ink, the app's tint.
/// The system draws a prominent label white on any tint, which vanishes on dark mode's white ink, so the
/// label takes the page's color while the button is enabled; a disabled one keeps the system's look.
struct MainActionButtonStyle: PrimitiveButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    MainActionButton(configuration: configuration)
  }
}

extension PrimitiveButtonStyle where Self == MainActionButtonStyle {
  static var mainAction: MainActionButtonStyle { MainActionButtonStyle() }
}

private struct MainActionButton: View {
  @Environment(\.isEnabled) private var isEnabled

  let configuration: PrimitiveButtonStyle.Configuration

  var body: some View {
    Button(configuration)
      .buttonStyle(.borderedProminent)
      .foregroundStyle(isEnabled ? AnyShapeStyle(.background) : AnyShapeStyle(.secondary))
  }
}
