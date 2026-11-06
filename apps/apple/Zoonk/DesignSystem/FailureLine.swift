import SwiftUI

/// Says what failed under what the learner tapped. VoiceOver reads it out when it shows, as main's
/// `role="alert"` does, since focus stays on the control that failed.
struct FailureLine: View {
  private let message: AttributedString
  private let systemImage: String?

  /// Localized as Markdown, so an email address in it stays a link.
  init(message: LocalizedStringResource, systemImage: String? = nil) {
    self.init(message: AttributedString(localized: message), systemImage: systemImage)
  }

  /// For words already localized, such as a server's message.
  init(message: String, systemImage: String? = nil) {
    self.init(message: AttributedString(message), systemImage: systemImage)
  }

  init(message: AttributedString, systemImage: String? = nil) {
    self.message = message
    self.systemImage = systemImage
  }

  var body: some View {
    line
      .foregroundStyle(.destructive)
      .announcesAlert(String(message.characters))
  }

  @ViewBuilder
  private var line: some View {
    if let systemImage {
      Label {
        Text(message)
      } icon: {
        Image(systemName: systemImage)
      }
    } else {
      Text(message)
    }
  }
}

extension View {
  /// VoiceOver reads `message` out as this view appears and whenever `message` changes, wherever
  /// focus is, as main's `role="alert"` does. A nil message says nothing.
  func announcesAlert(_ message: String?) -> some View {
    onChange(of: message, initial: true) {
      if let message {
        AccessibilityNotification.Announcement(message).post()
      }
    }
  }
}
