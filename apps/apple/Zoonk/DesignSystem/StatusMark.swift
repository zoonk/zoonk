import SwiftUI

struct StatusMark: View {
  enum Status {
    case done
    case next
    case skipped
    case todo
  }

  let status: Status

  @ScaledMetric(relativeTo: .body) private var nextSize = 12.0

  var body: some View {
    mark
      .markColumn()
      .accessibilityHidden(true)
  }

  @ViewBuilder
  private var mark: some View {
    switch status {
    case .done:
      Image(systemName: "checkmark")
        .fontWeight(.bold)
        .foregroundStyle(.success)
    case .next:
      // Resizable, so its ink centers in its box rather than sitting on a text baseline's.
      Image(systemName: "smallcircle.filled.circle.fill")
        .resizable()
        .scaledToFit()
        .symbolRenderingMode(.hierarchical)
        .frame(width: nextSize, height: nextSize)
        .foregroundStyle(.success)
    case .skipped:
      Image(systemName: "forward.fill")
        .imageScale(.small)
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    case .todo:
      Image(systemName: "circle.fill")
        .imageScale(.small)
        .typeStyle(.small)
        .foregroundStyle(Color(.foreground).opacity(0.2))
    }
  }
}

extension View {
  /// One width for every mark in a column of rows, so their titles start on one edge at every
  /// text size, whichever glyph each row has.
  func markColumn() -> some View {
    modifier(MarkColumn())
  }
}

private struct MarkColumn: ViewModifier {
  @ScaledMetric(relativeTo: .body) private var width = MarkColumnMetrics.width

  func body(content: Content) -> some View {
    content.frame(minWidth: width)
  }
}

private enum MarkColumnMetrics {
  static let width = 20.0
  static let gap = 12.0
}

extension View {
  /// A system `Label` drawn as a row takes `ListRow`'s mark column and gap, so a list's words
  /// start on one edge whichever piece draws each row.
  func rowLabelColumn() -> some View {
    modifier(RowLabelColumn())
  }
}

private struct RowLabelColumn: ViewModifier {
  @ScaledMetric(relativeTo: .body) private var width = MarkColumnMetrics.width

  func body(content: Content) -> some View {
    content
      .labelReservedIconWidth(width)
      .labelIconToTitleSpacing(MarkColumnMetrics.gap)
  }
}
