import Foundation

extension ActivityRendererRegistry {
  /// Every activity template the app draws, set once at the app root. A template missing here
  /// plays with the player's fallback canvas.
  static let app = ActivityRendererRegistry([
    .categorize
  ])
}
