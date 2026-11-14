import SwiftUI

/// A shared piece whose rows must line up, by the name every platform's layout captures use
/// (`scripts/verify/alignment-table.mts` declares what each must hold).
enum LayoutPiece: String {
  case listGroup = "list-group"
  case choiceList = "choice-list"
}

/// A part of a shared piece's row, as every platform's layout captures name it.
enum LayoutPart: String {
  /// A glyph or tile before the label.
  case mark
  /// A text column before the label, such as a numbered row's place.
  case lead
  /// The row's main text.
  case label
  /// A supporting line under the label.
  case note
  /// Short text at the row's end: a date, a count, a duration.
  case value
  /// What closes a row on its end edge: a chevron, a checkmark.
  case end
}

/// What a value says where the pieces' captures compare its face with its column's: a word in a
/// date's place ("Won", "Today") has its own face, as the dates have theirs.
enum LayoutRole: String {
  case date
  case words
}

/// Debug builds measure what the shared pieces laid out, for a capture of the screen
/// (`Testing/LayoutCapture.swift`); a release build reports nothing and changes nothing.
extension View {
  /// A row of `piece`: the parts inside it are its parts.
  func layoutRow(_ piece: LayoutPiece) -> some View {
    #if DEBUG
      modifier(LayoutRowReporter(piece: piece))
    #else
      self
    #endif
  }

  /// A part of the row around it; `text` names it in a capture's findings.
  func layoutPart(_ part: LayoutPart, text: Text? = nil) -> some View {
    #if DEBUG
      modifier(LayoutPartReporter(part: part, text: text))
    #else
      self
    #endif
  }

  /// What the value inside says, read by the value part around it.
  func layoutRole(_ role: LayoutRole) -> some View {
    #if DEBUG
      preference(key: LayoutRoleKey.self, value: role)
    #else
      self
    #endif
  }

  /// A place a screen's state pair compares in both captures, such as the bar that pins its main
  /// action; the actions inside take its name.
  func layoutAnchor(_ name: String) -> some View {
    #if DEBUG
      modifier(LayoutAnchorReporter(name: name))
    #else
      self
    #endif
  }

  /// A button, by its look: `filled` (the main action), `outline`, `ghost` or `destructive`.
  func layoutAction(_ variant: String) -> some View {
    #if DEBUG
      modifier(LayoutActionReporter(variant: variant))
    #else
      self
    #endif
  }

  /// The root of the app or of a presented screen, the surface its actions are counted on.
  func layoutSurface() -> some View {
    #if DEBUG
      modifier(LayoutSurfaceReporter())
    #else
      self
    #endif
  }

  /// Where text of a type role draws, so a part reports the role of its first line.
  func layoutType(_ style: TypeStyle) -> some View {
    #if DEBUG
      modifier(LayoutTypeReporter(style: style))
    #else
      self
    #endif
  }
}
