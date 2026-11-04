import SwiftUI

/// Main's color roles from `globals.css`, which `pnpm --filter apple palette` writes to
/// `Resources/Assets.xcassets/Palette` with light, dark and both more-contrast appearances. A mark,
/// fill or icon takes a role; colored words take its `-text` role. Ink and its pairs are
/// `Color(.foreground)`, `Color(.primary)` and `Color(.primaryForeground)`, since SwiftUI's own
/// `.foreground` and `.primary` styles have those names. A page is `Color(.systemBackground)`, as
/// a plain list's rows paint it: main's `background` in light and more contrast, black in dark.
extension ShapeStyle where Self == Color {
  static var success: Color { Color(.success) }
  static var successText: Color { Color(.successText) }
  static var destructive: Color { Color(.destructive) }
  static var destructiveText: Color { Color(.destructiveText) }
  static var warning: Color { Color(.warning) }
  static var warningText: Color { Color(.warningText) }
  static var brain: Color { Color(.brain) }
  static var brainText: Color { Color(.brainText) }
  static var energy: Color { Color(.energy) }

  static var mutedForeground: Color { Color(.mutedForeground) }
  static var faint: Color { Color(.faint) }
  static var card: Color { Color(.card) }
  static var muted: Color { Color(.muted) }
  static var surface3: Color { Color(.surface3) }
  static var border: Color { Color(.border) }
  static var input: Color { Color(.input) }
  static var selectedTint: Color { Color(.selectedTint) }

  static var vizAccent: Color { Color(.vizAccent) }
  static var vizHighlight: Color { Color(.vizHighlight) }
  static var vizSecondary: Color { Color(.vizSecondary) }
  static var vizGrid: Color { Color(.vizGrid) }
}
