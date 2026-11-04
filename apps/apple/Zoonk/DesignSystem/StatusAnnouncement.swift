import SwiftUI

extension View {
  /// VoiceOver reads `message` out, after what it's saying, each time it changes to a new line, as
  /// main's `role="status"` does. Put it on a view that stays on screen while the line comes and
  /// goes: a line already there when the view appears isn't read, like one a page opens with.
  func announcesStatus(_ message: String?) -> some View {
    onChange(of: message) { _, message in
      if let message {
        announcePolitely(message)
      }
    }
  }
}

/// Queued after what VoiceOver is reading, not over it.
func announcePolitely(_ text: String) {
  var announcement = AttributedString(text)
  announcement.accessibilitySpeechAnnouncementPriority = .low
  AccessibilityNotification.Announcement(announcement).post()
}
