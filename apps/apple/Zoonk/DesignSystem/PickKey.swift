import GameController
import SwiftUI

/// Main's `pickKey`: on a hardware keyboard, 1 to 9 pick the first nine options and 0, the key
/// after 9 on the number row, picks the tenth. Without an index, or past the tenth, no key.
struct PickKey: ViewModifier {
  let index: Int?

  private static func key(at index: Int) -> KeyEquivalent? {
    guard (0..<10).contains(index), let key = "\((index + 1) % 10)".first else { return nil }
    return KeyEquivalent(key)
  }

  func body(content: Content) -> some View {
    if let index, let key = Self.key(at: index) {
      content.keyboardShortcut(key, modifiers: [])
    } else {
      content
    }
  }
}

/// Whether a hardware keyboard is connected, so a key that picks shows only where it can be
/// pressed, as main shows one only with a fine pointer.
@MainActor @Observable
final class HardwareKeyboard {
  static let shared = HardwareKeyboard()

  private(set) var isConnected = GCKeyboard.coalesced != nil

  private init() {
    for name in [Notification.Name.GCKeyboardDidConnect, .GCKeyboardDidDisconnect] {
      NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { _ in
        MainActor.assumeIsolated {
          HardwareKeyboard.shared.isConnected = GCKeyboard.coalesced != nil
        }
      }
    }
  }
}
