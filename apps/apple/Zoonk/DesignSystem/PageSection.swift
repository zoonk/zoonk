import SwiftUI

extension EnvironmentValues {
  /// Inside a `BlockGridSection`, where a page's sections are blocks rather than a list's sections.
  @Entry var isGridBlock = false
}

extension ContainerValues {
  /// A block draws no hairline under this row, as the list draws none under a row that hides it.
  @Entry var hidesSeparatorBelow = false
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
/// panel, as main's missions card.
struct PageSection<Content: View, Header: View, Footer: View>: View {
  @Environment(\.isGridBlock) private var isGridBlock

  var isPanel = false
  @ViewBuilder let content: Content
  @ViewBuilder let header: Header
  @ViewBuilder let footer: Footer

  var body: some View {
    if isGridBlock {
      block
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
    let stack = VStack(alignment: .leading, spacing: 4) {
      header

      VStack(alignment: .leading, spacing: 0) {
        Group(subviews: content) { rows in
          ForEach(rows.indices, id: \.self) { index in
            let row = rows[index]

            row
              .padding(.vertical, 11)
              .frame(maxWidth: .infinity, alignment: .leading)

            if index < rows.count - 1, !row.containerValues.hidesSeparatorBelow {
              Divider()
            }
          }
        }
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

  @ViewBuilder let content: Content

  var body: some View {
    Section {
      BlockGrid(isStacked: isStacked) {
        content
      }
      .environment(\.isGridBlock, true)
      // A list row's buttons act as one; in blocks each row's button acts on its own.
      .buttonStyle(.plain)
      .listRowSeparator(.hidden)
    }
  }
}

private struct BlockGrid: Layout {
  var isStacked: Bool
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
    let columns = columns(for: bounds.width, count: subviews.count)
    var y = bounds.minY

    for (row, height) in rowHeights(subviews, width: bounds.width).enumerated() {
      for column in 0..<columns.count where row * columns.count + column < subviews.count {
        subviews[row * columns.count + column].place(
          at: CGPoint(x: bounds.minX + CGFloat(column) * (columns.width + columnSpacing), y: y),
          anchor: .topLeading, proposal: ProposedViewSize(width: columns.width, height: nil))
      }

      y += height + rowSpacing
    }
  }

  /// A lone block takes the whole width, such as the Plan's next steps where the tab bar already
  /// lists the other places.
  private func columns(for width: CGFloat, count: Int) -> (count: Int, width: CGFloat) {
    guard !isStacked, count > 1, width >= minimumColumn * 2 + columnSpacing else {
      return (1, width)
    }

    return (2, (width - columnSpacing) / 2)
  }

  private func rowHeights(_ subviews: Subviews, width: CGFloat) -> [CGFloat] {
    let columns = columns(for: width, count: subviews.count)

    return stride(from: 0, to: subviews.count, by: columns.count).map { start in
      subviews[start..<min(start + columns.count, subviews.count)]
        .map { $0.sizeThatFits(ProposedViewSize(width: columns.width, height: nil)).height }
        .max() ?? 0
    }
  }
}
