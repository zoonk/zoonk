import SwiftUI

/// A bar's buttons, as main's `bar-actions` and Android's `TaskActions`: a button joins the line
/// before it while their one-line labels fit, so a label never wraps or ends in "…" beside another
/// button. On a phone the main action (`barMainAction()`, or the last button), followed only by
/// glyphs such as the buddy's ask, takes what the others on its line leave, and joins their line
/// only while that leaves it at least as wide as each labeled button beside it with the glyphs
/// after it still beside it, so it's never the smaller answer; otherwise it starts a line under
/// them. On a line without it the labeled buttons share what's left equally, so one alone fills its
/// line; a glyph keeps its size. As main's `QuestionActions`, a bar with a way back
/// (`StepBackButton`) has no room for a labeled button before the main action, such as "I don't
/// know yet": each takes a line of its own above, and the way back starts the row under them. On a
/// wide bar (`WideBar`) each button keeps its own width and the lines end at the bar's end, with a
/// way back at its start, as main's wrap from `lg`. At accessibility text sizes each labeled button
/// takes a line of its own, except beside a way back, which keeps its row.
struct BarLines<Content: View>: View {
  var spacing: CGFloat
  var isWide = false
  @ViewBuilder let content: Content

  @Environment(\.displayScale) private var displayScale
  @Environment(\.stacksContent) private var isStacked

  var body: some View {
    BarLinesLayout(spacing: spacing, isWide: isWide, stacks: isStacked, scale: displayScale) {
      content
    }
    .layoutStacks(isStacked)
  }
}

struct BarLinesLayout: Layout {
  struct Slot: Equatable {
    var oneLine: CGFloat
    var isMain = false
    var isGlyph = false
    var isWayBack = false
  }

  var spacing: CGFloat
  var isWide = false
  var stacks = false
  var scale: CGFloat = 1

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? subviews.reduce(0) { $0 + $1.sizeThatFits(.unspecified).width }
    let heights = lineHeights(lines(subviews, width: width), subviews)
    return CGSize(
      width: width, height: heights.reduce(0, +) + spacing * CGFloat(max(heights.count - 1, 0)))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let lines = lines(subviews, width: bounds.width)
    let heights = lineHeights(lines, subviews)
    var y = bounds.minY

    for (line, height) in zip(lines, heights) {
      let used = line.reduce(0) { $0 + $1.1 } + spacing * CGFloat(line.count - 1)
      var x = Self.onGrid(isWide ? bounds.maxX - used : bounds.minX, scale: scale)

      for (position, (index, width)) in line.enumerated() {
        // On a wide bar the way back keeps the bar's start, away from the actions at its end.
        if isWide, position == 0, line.count > 1, subviews[index].containerValues.isBarWayBack {
          place(
            subviews[index], x: Self.onGrid(bounds.minX, scale: scale), y: y + height / 2, width)
          continue
        }

        place(subviews[index], x: x, y: y + height / 2, width)
        x += width + spacing
      }

      y += height + spacing
    }
  }

  private func place(_ subview: LayoutSubview, x: CGFloat, y: CGFloat, _ width: CGFloat) {
    subview.place(
      at: CGPoint(x: x, y: y), anchor: .leading,
      proposal: ProposedViewSize(width: width, height: nil))
  }

  private func lines(_ subviews: Subviews, width: CGFloat) -> [[(Int, CGFloat)]] {
    let main = subviews.firstIndex { $0[BarMainActionKey.self] } ?? subviews.indices.last

    let slots = subviews.indices.map { index in
      let ideal = subviews[index].sizeThatFits(.unspecified)
      let isMain = index == main
      // Only glyphs follow the main action; the ask's box grows wider than tall at large text.
      let isGlyph = !isMain && (index > (main ?? index) || ideal.width <= ideal.height)
      return Slot(
        oneLine: ideal.width, isMain: isMain, isGlyph: isGlyph,
        isWayBack: subviews[index].containerValues.isBarWayBack)
    }

    return Self.lines(
      slots, width: width, gap: spacing, isWide: isWide, stacks: stacks, scale: scale)
  }

  private func lineHeights(_ lines: [[(Int, CGFloat)]], _ subviews: Subviews) -> [CGFloat] {
    lines.map { line in
      line.map { subviews[$0.0].sizeThatFits(ProposedViewSize(width: $0.1, height: nil)).height }
        .max() ?? 0
    }
  }

  /// Each line's buttons, as their indexes in `slots` and widths. Every width is whole pixels:
  /// drawing rounds each edge to the nearest pixel, and a label that loses a fraction of a point of
  /// its one-line width to that wraps.
  static func lines(
    _ slots: [Slot], width: CGFloat, gap: CGFloat, isWide: Bool = false, stacks: Bool = false,
    scale: CGFloat = 1
  ) -> [[(Int, CGFloat)]] {
    let width = (width * scale).rounded(.down) / scale
    let slots = slots.map { slot in
      var slot = slot
      slot.oneLine = min((slot.oneLine * scale).rounded(.up) / scale, width)
      return slot
    }

    func after(_ index: Int) -> CGFloat {
      slots[(index + 1)...].prefix { $0.isGlyph }.reduce(0) { $0 + $1.oneLine + gap }
    }

    func needs(_ line: [Int], _ index: Int) -> CGFloat {
      let slot = slots[index]
      guard slot.isMain else { return slot.oneLine }
      if isWide { return slot.oneLine + after(index) }
      let beside = line.filter { !slots[$0].isGlyph }.map { slots[$0].oneLine }.max() ?? 0
      return max(slot.oneLine, beside) + after(index)
    }

    let mainAt = slots.firstIndex(where: \.isMain) ?? slots.endIndex
    let stacksEach = stacks && !slots.contains(where: \.isWayBack)
    let above =
      slots.contains(where: \.isWayBack) && !isWide
      ? slots.indices.filter { $0 < mainAt && !slots[$0].isGlyph } : []
    var lines = above.map { [$0] }
    var row: [[Int]] = []

    for index in slots.indices where !above.contains(index) {
      if let line = row.last,
        stacksEach
          ? slots[index].isGlyph
          : line.reduce(0, { $0 + slots[$1].oneLine + gap }) + needs(line, index) <= width
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
          if isWide || slot.isGlyph { 0 } else if let main { index == main ? left : 0 } else {
            onGrid(left / growing, scale: scale, rule: .down)
          }
        return (index, slot.oneLine + extra)
      }
    }
  }

  private static func onGrid(
    _ value: CGFloat, scale: CGFloat, rule: FloatingPointRoundingRule = .toNearestOrAwayFromZero
  ) -> CGFloat {
    (value * scale).rounded(rule) / scale
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
