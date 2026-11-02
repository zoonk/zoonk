import SwiftUI

extension ShapeStyle where Self == Color {
  static var success: Color { .blue }

  static var destructive: Color { .pink }

  static var warning: Color { .orange }

  /// Indigo is the system's violet; system purple sits at fuchsia, the mind map's hue.
  static var brain: Color { .indigo }

  static var energy: Color { .yellow }
}
