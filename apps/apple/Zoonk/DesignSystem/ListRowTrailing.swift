import SwiftUI

extension EnvironmentValues {
  @Entry fileprivate var rowTrailingGroup: Namespace.ID?
  @Entry fileprivate var rowTrailingAlignment = RowTrailingAlignment()
  @Entry var rowHasChevron = false
}

private struct RowTrailingSample: Equatable {
  let group: Namespace.ID
  let edge: CGFloat
  let hasChevron: Bool
  let isRTL: Bool
}

private struct RowTrailingPreference: PreferenceKey {
  static var defaultValue: [Namespace.ID: RowTrailingSample] { [:] }

  static func reduce(
    value: inout [Namespace.ID: RowTrailingSample],
    nextValue: () -> [Namespace.ID: RowTrailingSample]
  ) {
    value.merge(nextValue(), uniquingKeysWith: { _, new in new })
  }
}

private struct RowTrailingAlignment: Equatable {
  var rows: [Namespace.ID: RowTrailingSample] = [:]

  func inset(for id: Namespace.ID) -> CGFloat {
    guard let row = rows[id] else { return 0 }
    let edges = rows.values.filter { $0.group == row.group && $0.hasChevron }.map(\.edge)
    guard !edges.isEmpty else { return 0 }
    let end = row.isRTL ? edges.max() ?? row.edge : edges.min() ?? row.edge
    return max(0, row.isRTL ? end - row.edge : row.edge - end)
  }
}

struct ListRowTrailingScope: ViewModifier {
  @Namespace private var block

  func body(content: Content) -> some View {
    content.environment(\.rowTrailingGroup, block)
  }
}

struct ListRowTrailingHost: ViewModifier {
  @State private var alignment = RowTrailingAlignment()

  func body(content: Content) -> some View {
    content
      .environment(\.rowTrailingAlignment, alignment)
      .onPreferenceChange(RowTrailingPreference.self) {
        alignment.rows = $0
      }
  }
}

/// Native links and custom disclosures propose less room for the row's content. Siblings keep
/// that same trailing column; a section with no disclosure keeps its full width.
struct ListRowTrailing: ViewModifier {
  @Environment(\.rowTrailingGroup) private var group
  @Environment(\.rowTrailingAlignment) private var alignment
  @Environment(\.rowHasChevron) private var customChevron
  @Environment(\.navigationLinkIndicatorVisibility) private var nativeChevron
  @Environment(\.layoutDirection) private var direction
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.displayScale) private var displayScale
  @Namespace private var row

  /// A row, whose kept column holds the chevron unseen, as main's `ListRowChevronSpace` holds its
  /// room: a layout capture then reads that room as the other rows' chevron's.
  var isRow = false

  func body(content: Content) -> some View {
    let inset = isStacked ? 0 : alignment.inset(for: row)
    let hasChevron = customChevron || nativeChevron == .visible

    content
      .padding(.trailing, inset)
      .overlay(alignment: .trailing) {
        #if DEBUG
          if isRow, !hasChevron, inset > 0, LayoutCapture.isOn {
            Color.clear
              .frame(width: inset)
              .allowsHitTesting(false)
              .accessibilityHidden(true)
              .layoutPart(.holder)
          }
        #endif
      }
      .background {
        if let group, !isStacked {
          GeometryReader { proxy in
            let frame = proxy.frame(in: .global)
            let edge = direction == .rightToLeft ? frame.minX : frame.maxX
            Color.clear.preference(
              key: RowTrailingPreference.self,
              value: [
                row: RowTrailingSample(
                  // On the pixel grid: an edge a hair off its sibling's took a hair of inset,
                  // which moved it half a hair, and the rows re-measured each other forever.
                  group: group, edge: (edge * displayScale).rounded() / displayScale,
                  hasChevron: hasChevron,
                  isRTL: direction == .rightToLeft)
              ])
          }
        }
      }
  }
}

extension View {
  /// A header's value above the list's trailing column follows that column too.
  func chevronSlot() -> some View {
    modifier(ListRowTrailing())
  }
}
