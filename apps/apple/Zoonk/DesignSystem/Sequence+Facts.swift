import SwiftUI

extension Sequence<String> {
  /// Joins facts with “ · ”. A no-break space holds the dot to the fact before it, so a wrapped line
  /// never starts with it or leaves it alone, and a fact that leads with its number ("23 short
  /// lessons") keeps to one line, so the number never parts from its noun.
  func joinedFacts() -> String {
    map(\.asFact).joined(separator: "\u{00A0}· ")
  }
}

extension String {
  var asFact: String {
    guard let lead = first, lead.isNumber || lead == "~" else { return self }

    return replacing(" ", with: "\u{00A0}")
  }
}

struct FactSegments: View {
  let facts: [String]

  init(_ facts: [String]) { self.facts = facts }

  var body: some View {
    FlowLayout(spacing: 5, alignment: .firstTextBaseline, rowSpacing: 4) {
      ForEach(Array(facts.enumerated()), id: \.offset) { index, fact in
        if index > 0 {
          Canvas { context, size in
            context.fill(Path(ellipseIn: CGRect(origin: .zero, size: size)), with: .foreground)
          }
          .frame(idealWidth: 2, idealHeight: 2)
          .alignmentGuide(.firstTextBaseline) { $0[.bottom] + 4 }
          .layoutValue(key: FlowLayout.Separator.self, value: true)
          .accessibilityHidden(true)
        }
        Text(verbatim: fact.replacing(" ", with: "\u{00A0}"))
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(verbatim: facts.joinedFacts()))
  }
}
