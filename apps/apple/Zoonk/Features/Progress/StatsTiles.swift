import SwiftUI

enum StatTone {
  case brain
  case energy
  case neutral
  case success

  var color: Color {
    switch self {
    case .brain:
      .brain
    case .energy:
      .energy
    case .neutral:
      .mutedForeground
    case .success:
      .success
    }
  }
}

struct StatTile<Icon: View, Value: View>: View {
  let label: Text?
  let value: Value
  var tone = StatTone.neutral
  @ViewBuilder let icon: Icon
  var detail: Text?
  /// From 0 to 1.
  var meter: Double?
  var meterFill: Color = .success
  let spokenValue: Text

  @Environment(\.statTileOpens) private var opens
  @Environment(\.statTileLone) private var lone
  @Environment(\.statTileTitled) private var labelIsTitle

  var body: some View {
    VStack(alignment: .leading, spacing: lone ? 10 : 6) {
      if let label {
        HStack(spacing: 6) {
          icon
            .foregroundStyle(tone.color)
            .imageScale(.small)

          label
            .lineLimit(2)

          if opens {
            Spacer(minLength: 0)
            DisclosureChevron()
          }
        }
        .typeStyle(labelIsTitle ? .sectionTitle : .label)
        .foregroundStyle(labelIsTitle ? Color(.foreground) : .faint)
      }

      value
        .typeStyle(.readout)
        .foregroundStyle(tone == .brain ? Color.brainText : Color(.foreground))

      if let meter {
        Meter(value: meter, fill: meterFill)
          .padding(.vertical, 2)
      }

      if let detail {
        detail
          .typeStyle(lone ? .note : .meta)
          .foregroundStyle(.mutedForeground)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(lone ? 0 : 12)
    .overlay {
      if !lone {
        RoundedRectangle(cornerRadius: Radius.option, style: .continuous).strokeBorder(.border)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(label ?? accessibilityValue)
    .accessibilityValue(label == nil ? Text(verbatim: "") : accessibilityValue)
  }

  private var accessibilityValue: Text {
    guard let detail else {
      return spokenValue
    }

    return Text(
      "\(spokenValue), \(detail)", tableName: "Progress",
      comment: "Spoken value of a stat tile: its number, then the line under it")
  }
}

extension StatTile where Value == Text {
  init(
    label: Text?, value: Text, tone: StatTone = .neutral, @ViewBuilder icon: () -> Icon,
    detail: Text? = nil, meter: Double? = nil, spokenValue: Text? = nil,
    meterFill: Color = .success
  ) {
    self.init(
      label: label, value: value, tone: tone, icon: icon, detail: detail, meter: meter,
      meterFill: meterFill, spokenValue: spokenValue ?? value)
  }
}

extension StatTile where Icon == Image, Value == Text {
  init(
    label: Text?, value: Text, systemImage: String, tone: StatTone = .neutral, detail: Text? = nil,
    meter: Double? = nil, spokenValue: Text? = nil
  ) {
    self.init(
      label: label, value: value, tone: tone, icon: { Image(systemName: systemImage) },
      detail: detail,
      meter: meter, spokenValue: spokenValue)
  }
}

struct StatQuantity: View {
  let quantity: String

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight

  var body: some View {
    BigQuantity.text(
      quantity,
      unitFont: BigQuantity.unitFont(
        dynamicTypeSize: dynamicTypeSize, legibilityWeight: legibilityWeight))
  }
}

extension StatTile where Value == StatQuantity {
  init(
    label: Text?, quantity: String, tone: StatTone = .neutral, @ViewBuilder icon: () -> Icon,
    detail: Text? = nil, meter: Double? = nil, spokenValue: Text? = nil
  ) {
    self.init(
      label: label, value: StatQuantity(quantity: quantity), tone: tone, icon: icon,
      detail: detail, meter: meter, spokenValue: spokenValue ?? Text(verbatim: quantity))
  }
}

extension StatTile where Icon == Image, Value == StatQuantity {
  init(
    label: Text?, quantity: String, systemImage: String, tone: StatTone = .neutral,
    detail: Text? = nil, meter: Double? = nil, spokenValue: Text? = nil
  ) {
    self.init(
      label: label, quantity: quantity, tone: tone, icon: { Image(systemName: systemImage) },
      detail: detail, meter: meter, spokenValue: spokenValue)
  }
}

extension StatTile where Icon == EmptyView, Value == StatQuantity {
  /// A number with no label, for a block whose title already names it.
  init(quantity: String, detail: Text? = nil) {
    self.init(label: nil, quantity: quantity, icon: { EmptyView() }, detail: detail)
  }
}

extension EnvironmentValues {
  /// A tile that opens its page ends its label with the row chevron, as main's `opens`.
  @Entry var statTileOpens = false
  /// Main's lone stat: a grid of one tile draws it as its block's readout, with no box around it.
  @Entry var statTileLone = false
  /// Main's plan tiles title their number as a section does, where a stats tile labels it.
  @Entry var statTileTitled = false
}

/// Main's `StatTiles`: every row one height, so tiles of one grid match, and a lone tile drawn as
/// its block's readout.
struct StatTileGrid<Content: View>: View {
  /// Widest first.
  let columns: [Int]
  let minimumWidth: CGFloat
  @ViewBuilder let content: Content

  var body: some View {
    Group(subviews: content) { tiles in
      if tiles.count == 1 {
        tiles.environment(\.statTileLone, true)
      } else {
        StatTileRows(columns: columns, minimumWidth: minimumWidth) { tiles }
      }
    }
  }
}

private struct StatTileRows: Layout {
  /// Widest first.
  let columns: [Int]
  let minimumWidth: CGFloat
  var spacing: CGFloat = 8

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? CGFloat(columns.first ?? 1) * minimumWidth
    let rows = rows(count: subviews.count, width: width)
    let height = rows.reduce(0) { $0 + rowHeight($1, subviews: subviews, width: width) }

    return CGSize(width: width, height: height + spacing * CGFloat(max(rows.count - 1, 0)))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    var y = bounds.minY

    for row in rows(count: subviews.count, width: bounds.width) {
      let height = rowHeight(row, subviews: subviews, width: bounds.width)
      let itemWidth = itemWidth(in: row, width: bounds.width)
      var x = bounds.minX

      for index in row {
        subviews[index].place(
          at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: itemWidth, height: height))
        x += itemWidth + spacing
      }

      y += height + spacing
    }
  }

  private func rows(count: Int, width: CGFloat) -> [Range<Int>] {
    let perRow =
      columns.first { CGFloat($0) * minimumWidth + CGFloat($0 - 1) * spacing <= width } ?? 1

    return stride(from: 0, to: count, by: perRow).map { $0..<min($0 + perRow, count) }
  }

  private func itemWidth(in row: Range<Int>, width: CGFloat) -> CGFloat {
    (width - spacing * CGFloat(row.count - 1)) / CGFloat(row.count)
  }

  /// Each row as tall as its tallest tile, as main's grid rows: tiles side by side end level, and a
  /// tile on a row of its own keeps its own height.
  private func rowHeight(_ row: Range<Int>, subviews: Subviews, width: CGFloat) -> CGFloat {
    let proposal = ProposedViewSize(width: itemWidth(in: row, width: width), height: nil)
    return row.map { subviews[$0].sizeThatFits(proposal).height }.max() ?? 0
  }
}

/// Ringed so White shows on a light page and Black on a dark one.
struct BeltDot: View {
  let belt: ProgressBelt
  @ScaledMetric(relativeTo: .caption) private var size = 10.0

  var body: some View {
    Circle()
      .fill(belt.color)
      .strokeBorder(Color.mutedForeground.opacity(0.35), lineWidth: 1)
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }
}

struct StatsLine: View {
  let text: Text

  var body: some View {
    text
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
      .frame(maxWidth: 560, alignment: .leading)
  }
}
