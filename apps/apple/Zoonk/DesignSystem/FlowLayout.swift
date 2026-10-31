import SwiftUI

struct FlowLayout: Layout {
  var spacing: CGFloat = 8

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

      for index in row.indices {
        let size = Self.size(of: subviews[index], width: bounds.width)
        subviews[index].place(
          at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: ProposedViewSize(size)
        )
        x += size.width + spacing
      }

      y += row.height + spacing
    }
  }

  private struct Row {
    var indices: [Int] = []
    var width: CGFloat = 0
    var height: CGFloat = 0
  }

  private static func size(of subview: LayoutSubview, width: CGFloat) -> CGSize {
    let ideal = subview.sizeThatFits(.unspecified)
    guard ideal.width > width else { return ideal }
    return subview.sizeThatFits(ProposedViewSize(width: width, height: nil))
  }

  private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
    var rows: [Row] = []
    var row = Row()

    for index in subviews.indices {
      let size = Self.size(of: subviews[index], width: width)
      let needed = row.indices.isEmpty ? size.width : row.width + spacing + size.width

      if needed > width, !row.indices.isEmpty {
        rows.append(row)
        row = Row()
      }

      row.width = row.indices.isEmpty ? size.width : row.width + spacing + size.width
      row.height = max(row.height, size.height)
      row.indices.append(index)
    }

    if !row.indices.isEmpty {
      rows.append(row)
    }

    return rows
  }
}
