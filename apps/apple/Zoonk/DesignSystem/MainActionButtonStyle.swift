import SwiftUI

/// The system draws a prominent label white on any tint, which vanishes on dark mode's white ink, so the
/// label takes the page's color. Disabled, the dimmed ink left a near-white label on a near-white fill, so
/// a disabled one is a gray button with a label-colored title.
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
      .tint(isEnabled ? nil : Color(.systemGray3))
      .foregroundStyle(isEnabled ? AnyShapeStyle(.background) : AnyShapeStyle(Color(.label)))
  }
}
