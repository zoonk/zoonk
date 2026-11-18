import SwiftUI

extension Sequence<String> {
  /// Plain text for VoiceOver, editor values and names interpolated into sentences.
  /// Visible metadata uses `FactSegments` so wrapping happens between facts.
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
  struct Fact {
    let text: String
    var compact: String?
    var color: Color?
  }

  let facts: [Fact]

  /// Wrapped rows line up as the text around them does, such as on the end of a header's row.
  @Environment(\.multilineTextAlignment) private var textAlignment

  init(_ facts: [String]) { self.facts = facts.map { Fact(text: $0) } }
  init(facts: [Fact]) { self.facts = facts }

  var body: some View {
    FlowLayout(
      spacing: 5, alignment: .firstTextBaseline, rowAlignment: rowAlignment, rowSpacing: 4
    ) {
      ForEach(Array(facts.enumerated()), id: \.offset) { index, fact in
        if index > 0 {
          Text(verbatim: "·")
            .fixedSize()
            .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
            .clipped()
            .layoutValue(key: FlowLayout.Separator.self, value: true)
            .accessibilityHidden(true)
        }
        ViewThatFits(in: .horizontal) {
          text(fact.text, color: fact.color).fixedSize()
          if let compact = fact.compact { text(compact, color: fact.color).fixedSize() }
          text(fact.compact ?? fact.text, color: fact.color)
            .fixedSize(horizontal: false, vertical: true)
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(verbatim: facts.map(\.text).joinedFacts()))
  }

  private var rowAlignment: HorizontalAlignment {
    switch textAlignment {
    case .leading: .leading
    case .center: .center
    case .trailing: .trailing
    }
  }

  @ViewBuilder private func text(_ words: String, color: Color?) -> some View {
    if let color { Text(verbatim: words).foregroundStyle(color) } else { Text(verbatim: words) }
  }
}
