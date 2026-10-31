import SwiftUI

/// Items in rows that wrap like words. An item wider than the row wraps inside it.
struct FlowLayout: Layout {
  var spacing: CGFloat = 8
  /// How the items of a row line up: `.firstTextBaseline` keeps a sentence's pieces on one line
  /// when one of them wraps.
  var alignment: VerticalAlignment = .center

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let rows = arrange(subviews, width: proposal.width ?? .infinity)
    let width = rows.map { $0.width }.max() ?? 0
    let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(rows.count - 1, 0))
    return CGSize(width: min(width, proposal.width ?? width), height: height)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    var y = bounds.minY

    for row in arrange(subviews, width: bounds.width) {
      var x = bounds.minX

      for item in row.items {
        subviews[item.index].place(
          at: CGPoint(x: x, y: y + row.line - item.line), proposal: ProposedViewSize(item.size))
        x += item.size.width + spacing
      }

      y += row.height + spacing
    }
  }

  private struct Item {
    let index: Int
    let size: CGSize
    /// Where the alignment guide crosses the item, from its top.
    let line: CGFloat
  }

  private struct Row {
    var items: [Item] = []
    var width: CGFloat = 0
    /// Where the items' alignment guides meet, from the row's top.
    var line: CGFloat = 0
    var height: CGFloat = 0
  }

  private func item(_ index: Int, of subviews: Subviews, width: CGFloat) -> Item {
    let subview = subviews[index]
    let ideal = subview.sizeThatFits(.unspecified)
    let size =
      ideal.width > width
      ? subview.sizeThatFits(ProposedViewSize(width: width, height: nil)) : ideal

    return Item(
      index: index, size: size, line: subview.dimensions(in: ProposedViewSize(size))[alignment])
  }

  private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
    var rows: [Row] = []
    var row = Row()

    for index in subviews.indices {
      let item = item(index, of: subviews, width: width)
      let needed = row.items.isEmpty ? item.size.width : row.width + spacing + item.size.width

      if needed > width, !row.items.isEmpty {
        rows.append(row)
        row = Row()
      }

      let below = max(row.height - row.line, item.size.height - item.line)
      row.width = row.items.isEmpty ? item.size.width : row.width + spacing + item.size.width
      row.line = max(row.line, item.line)
      row.height = row.line + below
      row.items.append(item)
    }

    if !row.items.isEmpty {
      rows.append(row)
    }

    return rows
  }
}
