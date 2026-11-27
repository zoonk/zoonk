import SwiftUI

extension EnvironmentValues {
  /// Inside a `BlockGridSection`, where a page's sections are blocks rather than a list's sections.
  @Entry var isGridBlock = false
}

extension ContainerValues {
  /// A block draws no hairline under this row, as the list draws none under a row that hides it.
  @Entry var hidesSeparatorBelow = false
  /// A picked row: the hairlines touching it go clear, as the list hides them, so nothing moves
  /// when the pick does.
  @Entry var hidesSeparatorsAround = false
}

extension View {
  /// `listRowSeparator(.hidden, edges: .bottom)` that a block keeps too.
  func rowSeparatorHiddenBelow() -> some View {
    listRowSeparator(.hidden, edges: .bottom)
      .containerValue(\.hidesSeparatorBelow, true)
  }
}

/// A page's section: a list `Section`, or inside a `BlockGridSection` main's block, its title over
/// its rows with a hairline between them, as the list draws them. `isPanel` puts the block on a
/// panel, as main's missions card, in a list as in a grid.
struct PageSection<Content: View, Header: View, Footer: View>: View {
  @Environment(\.isGridBlock) private var isGridBlock

  var isPanel = false
  @ViewBuilder let content: Content
  @ViewBuilder let header: Header
  @ViewBuilder let footer: Footer

  var body: some View {
    section.modifier(ListRowTrailingScope())
  }

  @ViewBuilder private var section: some View {
    if isGridBlock {
      block
    } else if isPanel {
      Section {
        block
          .environment(\.isGridBlock, true)
          .buttonStyle(.plain)
          .listRowSeparator(.hidden)
          .listRowBackground(Color.clear)
      }
    } else if Footer.self == EmptyView.self {
      Section {
        content
      } header: {
        header
      }
    } else {
      Section {
        content
      } header: {
        header
      } footer: {
        footer
      }
    }
  }

  @ViewBuilder private var block: some View {
    // The room a list leaves between a section's title and its first row, so a block's rows start
    // where a list section's beside it do.
    let stack = VStack(alignment: .leading, spacing: 12) {
      header

      DividedRows {
        content
      }

      footer
    }
    .frame(maxWidth: .infinity, alignment: .leading)

    if isPanel {
      stack
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .panel()
    } else {
      stack
    }
  }
}

extension PageSection where Footer == EmptyView {
  init(
    isPanel: Bool = false, @ViewBuilder content: () -> Content, @ViewBuilder header: () -> Header
  ) {
    self.init(isPanel: isPanel, content: content, header: header) { EmptyView() }
  }
}

/// Main's tablet column under its list (`sm:grid-cols-2`): the page's sections as blocks, two to a
/// row, each row as tall as its taller block. One column where text stacks, two don't fit or
/// there's only one.
struct BlockGridSection<Content: View>: View {
  @Environment(\.stacksContent) private var isStacked

  /// Main's aside: the second block keeps this width beside the first, which takes the rest.
  var asideWidth: CGFloat?
  @ViewBuilder let content: Content

  var body: some View {
    Section {
      BlockGrid(isStacked: isStacked, asideWidth: asideWidth) {
        content
      }
      .environment(\.isGridBlock, true)
      .rowLabelColumn()
      // A list row's buttons act as one; in blocks each row's button acts on its own.
      .buttonStyle(.plain)
      .listRowSeparator(.hidden)
    }
  }
}

private struct BlockGrid: Layout {
  var isStacked: Bool
  var asideWidth: CGFloat?
  /// About a phone's narrowest column, so a block's rows read as they do on a phone.
  var minimumColumn: CGFloat = 280
  var columnSpacing: CGFloat = 40
  var rowSpacing: CGFloat = 32

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.replacingUnspecifiedDimensions().width
    let heights = rowHeights(subviews, width: width)

    return CGSize(
      width: width,
      height: heights.reduce(0, +) + rowSpacing * CGFloat(max(heights.count - 1, 0)))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let columns = columnWidths(for: bounds.width, count: subviews.count)
    var y = bounds.minY

    for (row, height) in rowHeights(subviews, width: bounds.width).enumerated() {
      var x = bounds.minX

      for (column, width) in columns.enumerated()
      where row * columns.count + column < subviews.count {
        subviews[row * columns.count + column].place(
          at: CGPoint(x: x, y: y), anchor: .topLeading,
          proposal: ProposedViewSize(width: width, height: nil))
        x += width + columnSpacing
      }

      y += height + rowSpacing
    }
  }

  /// A lone block takes the whole width, such as the Plan's next steps where the tab bar already
  /// lists the other places. With an aside, the first block takes what the aside leaves.
  private func columnWidths(for width: CGFloat, count: Int) -> [CGFloat] {
    guard !isStacked, count > 1 else {
      return [width]
    }

    if let asideWidth {
      return width >= minimumColumn + asideWidth + columnSpacing
        ? [width - asideWidth - columnSpacing, asideWidth] : [width]
    }

    guard width >= minimumColumn * 2 + columnSpacing else {
      return [width]
    }

    let half = (width - columnSpacing) / 2
    return [half, half]
  }

  private func rowHeights(_ subviews: Subviews, width: CGFloat) -> [CGFloat] {
    let columns = columnWidths(for: width, count: subviews.count)

    return stride(from: 0, to: subviews.count, by: columns.count).map { start in
      subviews[start..<min(start + columns.count, subviews.count)].enumerated()
        .map { column, subview in
          subview.sizeThatFits(ProposedViewSize(width: columns[column], height: nil)).height
        }
        .max() ?? 0
    }
  }
}

/// Main's `divided-rows` outside a list, as in a block or a sheet: rows one under the other as a
/// list section draws them, with a hairline between two.
struct DividedRows<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Group(subviews: content) { rows in
        ForEach(rows.indices, id: \.self) { index in
          let row = rows[index]

          row
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)

          if index < rows.count - 1, !row.containerValues.hidesSeparatorBelow {
            let next = rows[index + 1]

            Divider()
              .opacity(
                row.containerValues.hidesSeparatorsAround
                  || next.containerValues.hidesSeparatorsAround ? 0 : 1)
          }
        }
      }
    }
  }
}
