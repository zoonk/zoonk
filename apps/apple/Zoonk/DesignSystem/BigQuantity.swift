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
    Self.parts(text).reduce(Text(verbatim: "")) { line, part in
      part.isNumber
        ? Text("\(line)\(Text(verbatim: part.text))")
        : Text("\(line)\(Text(verbatim: part.text).font(unitFont).foregroundStyle(.mutedForeground))")
    }
    .typeStyle(.readout)
    .foregroundStyle(Color(.foreground))
  }

  private var unitFont: Font {
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
