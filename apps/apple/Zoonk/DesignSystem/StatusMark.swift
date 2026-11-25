import SwiftUI

struct StatusMark: View {
  enum Status {
    /// Main's `CurrentPhaseMark`: where the learner is in the plan, an ink dot in a faint ring.
    case currentPhase
    case done
    case next
    case skipped
    case todo
  }

  let status: Status

  @ScaledMetric(relativeTo: .body) private var nextSize = 12.0
  @ScaledMetric(relativeTo: .body) private var currentDot = 10.0
  @ScaledMetric(relativeTo: .body) private var currentRing = 4.0

  var body: some View {
    mark
      .markColumn()
      .accessibilityHidden(true)
  }

  @ViewBuilder
  private var mark: some View {
    switch status {
    case .currentPhase:
      Circle()
        .fill(Color(.foreground))
        .frame(width: currentDot, height: currentDot)
        .padding(currentRing)
        .background(Circle().fill(Color(.foreground).opacity(0.15)))
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
  /// text size. A mark never grows past it (`KindMark` shrinks a wide symbol): a glyph wider than
  /// its slot kept a list's rows re-measuring each other without end.
  func markColumn() -> some View {
    modifier(MarkColumn())
  }
}

private struct MarkColumn: ViewModifier {
  @Environment(\.stacksContent) private var isStacked
  @ScaledMetric(relativeTo: .body) private var width = MarkColumnMetrics.width

  func body(content: Content) -> some View {
    content.frame(minWidth: width, alignment: isStacked ? .leading : .center)
  }
}

enum MarkColumnMetrics {
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
