import SwiftUI

/// Main's `max-w-[85%]` and `width: 60%`: a row whose first view is offered a share of the width the
/// row gets, so it sizes against its own column (`containerRelativeFrame` sizes against the scroll
/// view, which can be wider). The views after it keep their size, as main's `shrink-0`, and the
/// first gives them room. The row fills the width and sits at `edge`.
struct ShareRow: Layout {
  let share: CGFloat
  var edge: HorizontalEdge = .leading
  var spacing: CGFloat = 8

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let sizes = sizes(of: subviews, width: proposal.width)
    return CGSize(width: proposal.width ?? length(sizes), height: sizes.map(\.height).max() ?? 0)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let sizes = sizes(of: subviews, width: bounds.width)
    var x = edge == .trailing ? bounds.maxX - length(sizes) : bounds.minX

    for (subview, size) in zip(subviews, sizes) {
      subview.place(
        at: CGPoint(x: x, y: bounds.midY), anchor: .leading, proposal: ProposedViewSize(size))
      x += size.width + spacing
    }
  }

  private func sizes(of subviews: Subviews, width: CGFloat?) -> [CGSize] {
    guard let first = subviews.first else { return [] }

    let rest = subviews.dropFirst().map {
      $0.sizeThatFits(ProposedViewSize(width: width, height: nil))
    }
    let taken = rest.reduce(0) { $0 + $1.width + spacing }
    let offered = width.map { max(0, min($0 * share, $0 - taken)) }

    return [first.sizeThatFits(ProposedViewSize(width: offered, height: nil))] + rest
  }

  private func length(_ sizes: [CGSize]) -> CGFloat {
    sizes.reduce(0) { $0 + $1.width } + spacing * CGFloat(max(sizes.count - 1, 0))
  }
}
