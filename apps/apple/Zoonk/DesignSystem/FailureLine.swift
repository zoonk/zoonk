import SwiftUI

/// Says what failed under what the learner tapped. VoiceOver reads it out when it shows, as main's
/// `role="alert"` does, since focus stays on the control that failed.
struct FailureLine: View {
  let message: LocalizedStringResource

  var body: some View {
    Text(message)
      .font(.footnote)
      .foregroundStyle(.destructive)
      .onAppear {
        AccessibilityNotification.Announcement(String(localized: message)).post()
      }
  }
}
