import SwiftUI

/// A phone's bar, as main's `bar-actions` and Android's `TaskActions`: a button joins the line
/// before it while their one-line labels fit. The main action (`barMainAction()`, or the last
/// button), followed only by glyphs such as the buddy's ask, takes what the others on its line
/// leave, and joins
/// their line only while that leaves it at least as wide as each labeled button beside it with the
/// glyphs after it still beside it, so it's never the smaller answer; otherwise it starts a line
/// under them. On a line without it the labeled buttons share what's left equally, so one alone
/// fills its line; a glyph keeps its size. As main's `QuestionActions`, a bar with a way back
/// (`StepBackButton`) has no room for a labeled button before the main action, such as "I don't
/// know yet": each takes a line of its own above, and the way back starts the row under them.
struct BarLines: Layout {
  struct Slot: Equatable {
    var oneLine: CGFloat
    var isMain = false
    var isGlyph = false
    var isWayBack = false
  }

  var spacing: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? subviews.reduce(0) { $0 + $1.sizeThatFits(.unspecified).width }
    let heights = lineHeights(
      Self.lines(slots(subviews, width: width), width: width, gap: spacing), subviews)
    return CGSize(
      width: width, height: heights.reduce(0, +) + spacing * CGFloat(max(heights.count - 1, 0)))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let lines = Self.lines(slots(subviews, width: bounds.width), width: bounds.width, gap: spacing)
    let heights = lineHeights(lines, subviews)
    var y = bounds.minY

    for (line, height) in zip(lines, heights) {
      var x = bounds.minX

      for (index, width) in line {
        subviews[index].place(
          at: CGPoint(x: x, y: y + height / 2), anchor: .leading,
          proposal: ProposedViewSize(width: width, height: nil))
        x += width + spacing
      }

      y += height + spacing
    }
  }

  private func slots(_ subviews: Subviews, width: CGFloat) -> [Slot] {
    let main = subviews.firstIndex { $0[BarMainActionKey.self] } ?? subviews.indices.last

    return subviews.indices.map { index in
      let ideal = subviews[index].sizeThatFits(.unspecified)
      let isMain = index == main
      // Only glyphs follow the main action; the ask's box grows wider than tall at large text.
      let isGlyph = !isMain && (index > (main ?? index) || ideal.width <= ideal.height)
      return Slot(
        oneLine: min(ideal.width, width), isMain: isMain, isGlyph: isGlyph,
        isWayBack: subviews[index].containerValues.isBarWayBack)
    }
  }

  private func lineHeights(_ lines: [[(Int, CGFloat)]], _ subviews: Subviews) -> [CGFloat] {
    lines.map { line in
      line.map { subviews[$0.0].sizeThatFits(ProposedViewSize(width: $0.1, height: nil)).height }
        .max() ?? 0
    }
  }

  /// Each line's buttons, as their indexes in `slots` and widths.
  static func lines(_ slots: [Slot], width: CGFloat, gap: CGFloat) -> [[(Int, CGFloat)]] {
    func after(_ index: Int) -> CGFloat {
      slots[(index + 1)...].prefix { $0.isGlyph }.reduce(0) { $0 + $1.oneLine + gap }
    }

    func needs(_ line: [Int], _ index: Int) -> CGFloat {
      let slot = slots[index]
      let beside = line.filter { !slots[$0].isGlyph }.map { slots[$0].oneLine }.max() ?? 0
      return slot.isMain ? max(slot.oneLine, beside) + after(index) : slot.oneLine
    }

    let mainAt = slots.firstIndex(where: \.isMain) ?? slots.endIndex
    let above =
      slots.contains(where: \.isWayBack)
      ? slots.indices.filter { $0 < mainAt && !slots[$0].isGlyph } : []
    var lines = above.map { [$0] }
    var row: [[Int]] = []

    for index in slots.indices where !above.contains(index) {
      if let line = row.last,
        line.reduce(0, { $0 + slots[$1].oneLine + gap }) + needs(line, index) <= width
      {
        row[row.count - 1].append(index)
      } else {
        row.append([index])
      }
    }

    lines += row

    return lines.map { line in
      let left = width - line.reduce(0) { $0 + slots[$1].oneLine } - gap * CGFloat(line.count - 1)
      let main = line.first { slots[$0].isMain }
      let growing = CGFloat(line.filter { !slots[$0].isGlyph }.count)

      return line.map { index in
        let slot = slots[index]
        let extra: CGFloat =
          if slot.isGlyph { 0 } else if let main { index == main ? left : 0 } else {
            left / growing
          }
        return (index, slot.oneLine + extra)
      }
    }
  }
}

private struct BarMainActionKey: LayoutValueKey {
  static let defaultValue = false
}

extension View {
  /// The bar's main action, for a bar where glyphs such as the buddy's ask follow it (`BarLines`).
  func barMainAction() -> some View {
    layoutValue(key: BarMainActionKey.self, value: true)
  }
}

extension ContainerValues {
  /// A bar's way back one screen (`StepBackButton`), which sends the bar's labeled answers to the line
  /// above (`BarLines`).
  @Entry var isBarWayBack = false
}
