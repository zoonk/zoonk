import SwiftUI

/// A week's days across the row, as main's weeks are: the first day's mark on the row's start
/// edge, the last's on its end, the same room between each. A day is centered on its mark, as wide
/// as `dayWidth` gives it, so a tapped day keeps a 44pt target that reaches into the page's margin
/// at the ends and shares the room with its neighbors where they're closer than that. Each day says
/// how wide its mark is with `weekDayMark(width:)`.
struct WeekDaysRow: Layout {
  /// The target a tapped day keeps; nil where days aren't tapped, so each takes the room to its
  /// neighbors.
  var target: CGFloat?

  static func dayWidth(rowWidth: CGFloat, markWidth: CGFloat, days: Int, target: CGFloat?)
    -> CGFloat
  {
    let step = days > 1 ? (rowWidth - markWidth) / CGFloat(days - 1) : rowWidth
    return target.map { min($0, step) } ?? step
  }

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? CGFloat(subviews.count) * (target ?? 44)
    let day = dayWidth(width, subviews)
    let height =
      subviews.map { $0.sizeThatFits(ProposedViewSize(width: day, height: nil)).height }
      .max() ?? 0

    return CGSize(width: width, height: max(height, target ?? 0))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let mark = markWidth(subviews)
    let step = subviews.count > 1 ? (bounds.width - mark) / CGFloat(subviews.count - 1) : 0
    let day = dayWidth(bounds.width, subviews)

    for (index, subview) in subviews.enumerated() {
      subview.place(
        at: CGPoint(x: bounds.minX + mark / 2 + CGFloat(index) * step, y: bounds.minY),
        anchor: .top, proposal: ProposedViewSize(width: day, height: bounds.height))
    }
  }

  private func markWidth(_ subviews: Subviews) -> CGFloat {
    subviews.map { $0[WeekDayMarkWidth.self] }.max() ?? 0
  }

  private func dayWidth(_ rowWidth: CGFloat, _ subviews: Subviews) -> CGFloat {
    Self.dayWidth(
      rowWidth: rowWidth, markWidth: markWidth(subviews), days: subviews.count, target: target)
  }
}

private struct WeekDayMarkWidth: LayoutValueKey {
  static let defaultValue: CGFloat = 0
}

extension View {
  /// A day in a `WeekDaysRow`, with the width of its mark, which sits on the row's edges.
  func weekDayMark(width: CGFloat) -> some View {
    frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(.rect)
      .layoutAnchor("week-day")
      .layoutValue(key: WeekDayMarkWidth.self, value: width)
  }
}
