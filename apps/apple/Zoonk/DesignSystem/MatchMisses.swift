import SwiftUI

/// Main's `MatchMisses`: under a match board's verdict, the pairs the learner first put together
/// wrong, since the solved board above them shows every pair right. One line per card that had a
/// wrong try, its first one, for the first few cards. Each card shows as written, since one can be a
/// sentence with its own punctuation.
struct MatchMisses: View {
  private let lines: [RichInline]

  /// `card` is nil for a card the board no longer has, which leaves its try out.
  init(_ misses: [MatchTry], card: (MatchCardRef) -> RichInline?) {
    var tried = Set<Int>()

    lines = Array(
      misses
        .filter { tried.insert($0.left).inserted }
        .compactMap { miss in
          card(.left(miss.left)).flatMap { left in
            card(.right(miss.right)).map { right in left + Self.arrow + right }
          }
        }
        .prefix(Self.shown))
  }

  private static let shown = 3

  private static let arrow: RichInline = {
    var arrow = AttributedString(" → ")
    arrow.foregroundColor = .mutedForeground
    return RichInline(text: arrow)
  }()

  private static let lead = LocalizedStringResource(
    "You first matched:", table: "DesignSystem",
    comment:
      "Under a matching question's verdict, before the pairs of cards the learner first put together wrong, one per line as “card → card”."
  )

  /// For an announcement: nil when nothing was matched wrong.
  var said: String? {
    lines.isEmpty
      ? nil : ([String(localized: Self.lead)] + lines.map(\.said)).joined(separator: "\n")
  }

  @Environment(\.legibilityWeight) private var legibilityWeight

  var body: some View {
    if !lines.isEmpty {
      VStack(alignment: .leading, spacing: 4) {
        Text(Self.lead)

        ForEach(lines.indices, id: \.self) { index in
          Text(lines[index], legibility: legibilityWeight)
        }
      }
      .typeStyle(.body)
      .foregroundStyle(Color(.foreground))
      .accessibilityElement(children: .combine)
    }
  }
}
