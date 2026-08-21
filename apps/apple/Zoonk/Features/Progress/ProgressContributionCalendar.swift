import SwiftUI

struct ProgressContributionCalendar: View {
  let weeks: [ProgressContributionWeek]
  let maximumIntensity: Int
  let tint: Color
  let lowLabel: Text
  let highLabel: Text
  let accessibilityLabel: Text
  let accessibilityValue: (ProgressContributionPoint) -> Text

  @State private var selectedPoint: ProgressContributionPoint?
  @ScaledMetric(relativeTo: .caption) private var markSize: CGFloat = 15
  private let markSpacing: CGFloat = 3
  private let monthHeaderHeight: CGFloat = 20

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      GeometryReader { geometry in
        ScrollView(.horizontal) {
          HStack(alignment: .top, spacing: 0) {
            ForEach(weeks) { week in
              weekColumn(week)
            }
          }
          .contentShape(.rect)
          .simultaneousGesture(
            SpatialTapGesture()
              .onEnded { gesture in
                selectedPoint = ProgressContributionSelection.nearestPoint(
                  to: gesture.location,
                  in: weeks,
                  cellSize: cellSize,
                  headerHeight: monthHeaderHeight)
              })
        }
        .frame(width: fittedPlotWidth(availableWidth: geometry.size.width))
        .frame(maxWidth: .infinity, alignment: .trailing)
      }
      .frame(height: plotHeight)
      .defaultScrollAnchor(.trailing)

      legend
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(accessibilityLabel)
  }

  private func weekColumn(_ week: ProgressContributionWeek) -> some View {
    VStack(spacing: 0) {
      ForEach(week.slots) { slot in
        contributionSlot(slot)
      }
    }
    .padding(.top, monthHeaderHeight)
    .overlay(alignment: .topLeading) {
      if let monthLabelDate = week.monthLabelDate, let month = monthLabelDate.date() {
        Text(month, format: .dateTime.month(.abbreviated))
          .font(.caption2)
          .foregroundStyle(.secondary)
          .fixedSize()
          .accessibilityHidden(true)
      }
    }
  }

  @ViewBuilder
  private func contributionSlot(_ slot: ProgressContributionSlot) -> some View {
    if let point = slot.point {
      RoundedRectangle(cornerRadius: 3, style: .continuous)
        .fill(fillColor(for: point.intensity))
        .frame(width: markSize, height: markSize)
        .frame(width: cellSize, height: cellSize)
        .contentShape(.rect)
        .accessibilityElement()
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(dateLabel(point.date))
        .accessibilityValue(accessibilityValue(point))
        .accessibilityAction {
          selectedPoint = point
        }
        .popover(
          isPresented: selectionBinding(for: point),
          attachmentAnchor: .rect(.bounds),
          arrowEdge: .bottom
        ) {
          contributionDetails(point)
            .presentationCompactAdaptation(.popover)
        }
    } else {
      Color.clear
        .frame(width: cellSize, height: cellSize)
        .accessibilityHidden(true)
    }
  }

  private func contributionDetails(_ point: ProgressContributionPoint) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      dateLabel(point.date)
        .font(.caption)
        .foregroundStyle(.secondary)

      accessibilityValue(point)
        .font(.subheadline.bold())
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .fixedSize()
    .accessibilityElement(children: .combine)
  }

  private var legend: some View {
    HStack(spacing: 5) {
      lowLabel

      ForEach(0...maximumIntensity, id: \.self) { intensity in
        RoundedRectangle(cornerRadius: 2, style: .continuous)
          .fill(fillColor(for: intensity))
          .frame(width: 10, height: 10)
      }

      highLabel
    }
    .font(.caption2)
    .foregroundStyle(.secondary)
    .frame(maxWidth: .infinity, alignment: .trailing)
    .accessibilityHidden(true)
  }

  private func fillColor(for intensity: Int) -> Color {
    guard intensity > 0 else {
      return Color(uiColor: .tertiarySystemFill)
    }

    let opacity = intensity >= maximumIntensity ? 1 : Double(intensity) * 0.2
    return tint.opacity(opacity)
  }

  private var plotHeight: CGFloat {
    monthHeaderHeight + cellSize * 7
  }

  private func fittedPlotWidth(availableWidth: CGFloat) -> CGFloat {
    let columnCount = max(floor(availableWidth / cellSize), 1)
    return min(columnCount * cellSize, availableWidth)
  }

  private var cellSize: CGFloat {
    markSize + markSpacing
  }

  private func selectionBinding(for point: ProgressContributionPoint) -> Binding<Bool> {
    Binding(
      get: { selectedPoint?.id == point.id },
      set: { isPresented in
        if !isPresented, selectedPoint?.id == point.id {
          selectedPoint = nil
        }
      })
  }

  private func dateLabel(_ date: ProgressDate) -> Text {
    guard let foundationDate = date.date() else {
      return Text(verbatim: date.id)
    }

    return Text(foundationDate, format: .dateTime.month(.wide).day().year())
  }
}
