import SwiftUI

/// Main's `BigQuantity` (Android's `Readout`): a quantity the eye lands on, its numbers in the readout role with tabular
/// figures and its words ("min left", "/ 5 hr") smaller and medium in the secondary color.
struct BigQuantity: View {
  let text: String

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    Self.text(
      text,
      unitFont: Self.unitFont(dynamicTypeSize: dynamicTypeSize, legibilityWeight: legibilityWeight)
    )
    .typeStyle(.readout)
    .foregroundStyle(Color(.foreground))
  }

  /// The quantity as one `Text` for a view that sets the readout role and its color itself, such as
  /// a stat tile: its numbers take the role, its words `unitFont` in the secondary color.
  nonisolated static func text(_ text: String, unitFont: Font) -> Text {
    parts(text).reduce(Text(verbatim: "")) { line, part in
      part.isNumber
        ? Text("\(line)\(Text(verbatim: part.text))")
        : Text(
          "\(line)\(Text(verbatim: part.text).font(unitFont).foregroundStyle(.mutedForeground))")
    }
  }

  /// Main's `max(0.45em, 0.8125rem)` medium words beside a 24pt readout, Bold Text included.
  static func unitFont(dynamicTypeSize: DynamicTypeSize, legibilityWeight: LegibilityWeight?)
    -> Font
  {
    var environment = EnvironmentValues()
    environment.dynamicTypeSize = dynamicTypeSize
    environment.legibilityWeight = legibilityWeight
    return TypeStyle.smallButton.font(in: environment)
  }

  /// Main's `splitQuantity`: a number keeps its sign, its separators and a percent sign.
  nonisolated static func parts(_ text: String) -> [(text: String, isNumber: Bool)] {
    var parts: [(text: String, isNumber: Bool)] = []
    var rest = Substring(text)

    while let match = rest.firstMatch(of: /[~≈+\-−]?\d[\d.,:]*(?:[\u{00A0}\u{202F}]?%)?/) {
      if match.range.lowerBound > rest.startIndex {
        parts.append((String(rest[..<match.range.lowerBound]), false))
      }

      parts.append((String(match.output), true))
      rest = rest[match.range.upperBound...]
    }

    if !rest.isEmpty {
      parts.append((String(rest), false))
    }

    return parts
  }
}
