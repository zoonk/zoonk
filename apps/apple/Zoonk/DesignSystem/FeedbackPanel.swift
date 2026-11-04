import SwiftUI

/// Main's `FeedbackTone`: what a checked answer was.
enum FeedbackTone {
  case right
  case neutral
  case almost
  case wrong

  /// The verdict's words and glyph, which read on the page and on a panel.
  var words: Color {
    switch self {
    case .right: .successText
    case .neutral: Color(.foreground)
    case .almost: .warningText
    case .wrong: .destructiveText
    }
  }

  var symbol: String {
    switch self {
    case .right: "checkmark"
    case .neutral: "minus"
    case .almost, .wrong: "xmark"
    }
  }
}

/// Main's `FeedbackVerdict`: the verdict in its tone's color, a quiet detail at its end.
struct FeedbackVerdict<End: View>: View {
  let title: Text
  let tone: FeedbackTone
  var symbol: String?
  @ViewBuilder var end: () -> End

  init(
    _ title: Text, tone: FeedbackTone, symbol: String? = nil,
    @ViewBuilder end: @escaping () -> End = { EmptyView() }
  ) {
    self.title = title
    self.tone = tone
    self.symbol = symbol
    self.end = end
  }

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Label {
        title
      } icon: {
        Image(systemName: symbol ?? tone.symbol)
      }
      .typeStyle(.verdict)
      .foregroundStyle(tone.words)
      .frame(maxWidth: .infinity, alignment: .leading)

      end()
        .typeStyle(.meta.weight(.medium))
        .foregroundStyle(.mutedForeground)
    }
  }
}

extension View {
  /// Main's `FeedbackPanel`: a checked answer's verdict and what it explains, on a panel.
  func feedbackPanel() -> some View {
    frame(maxWidth: .infinity, alignment: .leading)
      .padding(16)
      .panel()
  }
}
