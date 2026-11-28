import SwiftUI

extension View {
  /// Main's `text-wrap: balance` for a title's role: a title that wraps breaks where its lines come
  /// out about even, instead of leaving a word or two alone on the last.
  func balancedLines() -> some View {
    BalancedLines { self }
  }
}

/// Lays its text out at the narrowest width that keeps the lines it takes at the width offered.
private struct BalancedLines: Layout {
  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    guard let text = subviews.first else { return .zero }
    return text.sizeThatFits(balanced(proposal, text))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    subviews.first?.place(
      at: bounds.origin,
      proposal: balanced(ProposedViewSize(width: bounds.width, height: nil), subviews[0]))
  }

  private func balanced(_ proposal: ProposedViewSize, _ text: LayoutSubview) -> ProposedViewSize {
    guard let width = proposal.width, width.isFinite, width > 0 else { return proposal }

    let height = text.sizeThatFits(ProposedViewSize(width: width, height: nil)).height
    var narrow = 0.0
    var wide = width

    // Halving the range eight times finds the width to within a 256th of the line.
    for _ in 0..<8 {
      let middle = (narrow + wide) / 2

      if text.sizeThatFits(ProposedViewSize(width: middle, height: nil)).height <= height + 0.5 {
        wide = middle
      } else {
        narrow = middle
      }
    }

    return ProposedViewSize(width: wide, height: proposal.height)
  }
}
