import GameController
import SwiftUI

extension EnvironmentValues {
  /// A hardware keyboard is connected, so a key's hint (an option's number, "or press Space") means
  /// something. None outside the app's window, as on a phone with no keyboard; a test says which.
  @Entry var hasHardwareKeyboard = false
}

extension View {
  /// Follows whether a hardware keyboard is connected, as it connects and disconnects.
  func followsHardwareKeyboard() -> some View {
    modifier(HardwareKeyboardPresence())
  }
}

private struct HardwareKeyboardPresence: ViewModifier {
  @State private var isConnected = GCKeyboard.coalesced != nil

  func body(content: Content) -> some View {
    content
      .environment(\.hasHardwareKeyboard, isConnected)
      .onReceive(NotificationCenter.default.publisher(for: .GCKeyboardDidConnect)) { _ in
        isConnected = true
      }
      .onReceive(NotificationCenter.default.publisher(for: .GCKeyboardDidDisconnect)) { _ in
        isConnected = GCKeyboard.coalesced != nil
      }
  }
}
