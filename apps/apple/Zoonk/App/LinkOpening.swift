import SwiftUI

/// What a tapped link may open. Lesson text, summaries and sources come from AI and research, so a
/// link in them can name any scheme: only web pages, email and the app's own Settings page open,
/// never a call, a message or another app.
@MainActor
enum LinkOpening {
  private static let schemes: Set<String> = [
    "http", "https", "mailto",
    URL(string: UIApplication.openSettingsURLString)?.scheme ?? "app-settings",
  ]

  static func mayOpen(_ url: URL) -> Bool {
    url.scheme.map { schemes.contains($0.lowercased()) } ?? false
  }

  static func open(_ url: URL) -> OpenURLAction.Result {
    mayOpen(url) ? .systemAction : .discarded
  }
}
