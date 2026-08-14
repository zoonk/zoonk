import SwiftUI

let authenticationButtonCornerRadius: CGFloat = 6
let authenticationButtonMaximumWidth: CGFloat = 360

private struct AuthenticationButtonFrame: ViewModifier {
  @ScaledMetric(relativeTo: .body) private var minimumHeight: CGFloat = 50

  let alignment: Alignment

  func body(content: Content) -> some View {
    content.frame(maxWidth: .infinity, minHeight: minimumHeight, alignment: alignment)
  }
}

extension View {
  func authenticationButtonFrame(alignment: Alignment = .center) -> some View {
    modifier(AuthenticationButtonFrame(alignment: alignment))
  }
}

struct AuthenticationButtonStyle: ButtonStyle {
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .opacity(opacity(isPressed: configuration.isPressed))
  }

  private func opacity(isPressed: Bool) -> Double {
    if !isEnabled {
      return 0.45
    }

    return isPressed ? 0.72 : 1
  }
}
