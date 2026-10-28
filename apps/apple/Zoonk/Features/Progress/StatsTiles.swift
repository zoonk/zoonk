import SwiftUI

/// A stat's color, on its icon (main's `StatTile` tones): blue for progress made, yellow for
/// Energy, indigo for Brain Power (its number too); time and counts stay neutral.
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

/// One number on its tile: the icon in its stat's color and what it counts as a quiet label on
/// top, the number as a readout under it (units small beside it), and an optional quiet line or
/// meter. VoiceOver reads it as one element: its label, then the number and the line as its value.
struct StatTile<Icon: View>: View {
  let label: Text
  let value: Text
  var tone = StatTone.neutral
  @ViewBuilder let icon: Icon
  var detail: Text?
  /// A share from 0 to 1 as a thin bar under the number (how far into the level), decorative.
  var meter: Double?
  /// The number as VoiceOver says it, where it reads differently from how it shows ("175 of 247").
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

/// A few tiles side by side, as many a row as `columns` allows at the width (the first count that
/// fits), with every tile in a row as tall as the tallest. A last row with fewer tiles spreads them
/// across it, so an odd third tile takes the whole row on a phone.
struct StatTileGrid: Layout {
  /// The column counts to try, widest first ([4, 2, 1] on the overview, [3, 2, 1] on a page).
  let columns: [Int]
  /// The narrowest a tile may get before the grid drops to fewer columns.
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

/// The belt as a dot in its own color, ringed so White shows on a light page and Black on a dark
/// one (main's `BeltIndicator`).
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

/// A stat page's one plain line under its visual: what moves the number.
struct StatsLine: View {
  let text: Text

  var body: some View {
    text
      .font(.subheadline)
      .foregroundStyle(.secondary)
      .frame(maxWidth: 560, alignment: .leading)
  }
}
