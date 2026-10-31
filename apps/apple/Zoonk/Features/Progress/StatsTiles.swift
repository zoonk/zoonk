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
      .secondary
    case .success:
      .success
    }
  }
}

struct StatTile<Icon: View>: View {
  let label: Text
  let value: Text
  var tone = StatTone.neutral
  @ViewBuilder let icon: Icon
  var detail: Text?
  /// From 0 to 1.
  var meter: Double?
  var spokenValue: Text?

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        icon
          .foregroundStyle(tone.color)
          .imageScale(.small)

        label
          .lineLimit(2)
      }
      .font(.caption.weight(.medium))
      .textCase(.uppercase)
      .foregroundStyle(.secondary)

      value
        .font(.title2.weight(.semibold))
        .monospacedDigit()
        .foregroundStyle(tone == .brain ? Color.brain : Color.primary)

      if let detail {
        detail
          .font(.caption)
          .foregroundStyle(.secondary)
      }

      if let meter {
        ProgressView(value: meter)
          .tint(.brain)
          .padding(.top, 4)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(12)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 12, style: .continuous)
    )
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(label)
    .accessibilityValue(accessibilityValue)
  }

  private var accessibilityValue: Text {
    let number = spokenValue ?? value

    guard let detail else {
      return number
    }

    return Text(
      "\(number), \(detail)", tableName: "Progress",
      comment: "Spoken value of a stat tile: its number, then the line under it")
  }
}

extension StatTile where Icon == Image {
  init(
    label: Text, value: Text, systemImage: String, tone: StatTone = .neutral, detail: Text? = nil,
    meter: Double? = nil, spokenValue: Text? = nil
  ) {
    self.init(
      label: label, value: value, tone: tone, icon: { Image(systemName: systemImage) },
      detail: detail,
      meter: meter, spokenValue: spokenValue)
  }
}

struct StatTileGrid: Layout {
  /// Widest first.
  let columns: [Int]
  let minimumWidth: CGFloat
  var spacing: CGFloat = 8

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? CGFloat(columns.first ?? 1) * minimumWidth
    let rows = rows(count: subviews.count, width: width)
    let height = rows.reduce(0) { total, row in
      total + rowHeight(row, subviews: subviews, width: width)
    }

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
      .strokeBorder(.secondary.opacity(0.35), lineWidth: 1)
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }
}

struct StatsLine: View {
  let text: Text

  var body: some View {
    text
      .font(.subheadline)
      .foregroundStyle(.secondary)
      .frame(maxWidth: 560, alignment: .leading)
  }
}
