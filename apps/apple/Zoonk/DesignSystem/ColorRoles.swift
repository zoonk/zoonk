import SwiftUI

/// Zoonk's color meanings (`apps/playground/src/design-system/color.ts`) as system colors, so Dark Mode,
/// Increase Contrast and every display come from iOS. Neutral roles need no name of their own: words take
/// `.primary`, `.secondary` and `.tertiary`, surfaces the system backgrounds, lines `.separator`, and the
/// main action the app's tint, the label color from `AccentColor`.
extension ShapeStyle where Self == Color {
  /// Progress made and where the learner is now: done, right, studied, reached, a day of activity.
  static var success: Color { .blue }

  /// Wrong or removed: a wrong answer, bad news in a plan change, an inline error.
  static var destructive: Color { .pink }

  /// Look here: a flag, a suggestion, the one thing to improve.
  static var warning: Color { .orange }

  /// Brain Power, and nothing else: an amount earned, the missions, the bar toward the next level. Indigo
  /// is the system's violet; system purple sits at fuchsia, the mind map's hue.
  static var brain: Color { .indigo }

  /// The buddy's Energy: its meter and its bolt.
  static var energy: Color { .yellow }
}
