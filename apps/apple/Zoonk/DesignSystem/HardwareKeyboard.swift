import SwiftUI

extension EnvironmentValues {
  /// A hardware keyboard is connected, so a key's hint (an option's number, "or press Space") means
  /// something. None outside the app's window, as on a phone with no keyboard; a test says which.
  @Entry var hasHardwareKeyboard = false
}

extension View {
  /// Follows whether a hardware keyboard is connected (`HardwareKeyboard`), as it connects and
  /// disconnects.
  func followsHardwareKeyboard() -> some View {
    modifier(HardwareKeyboardPresence())
  }
}

private struct HardwareKeyboardPresence: ViewModifier {
  func body(content: Content) -> some View {
    content.environment(\.hasHardwareKeyboard, HardwareKeyboard.shared.isConnected)
  }
}
