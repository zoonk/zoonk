import SwiftUI

/// Main's `CoverageBar`: what is done of a goal's lessons on one track, the lessons studied, then
/// the ones the learner already knew. Shares are 0 to 1.
struct CoverageBar: View {
  let studied: Double
  var known: Double = 0

  var body: some View {
    let studied = min(max(studied, 0), 1)
    let known = min(max(known, 0), 1 - studied)

    Canvas { context, size in
      let track = Path(
        roundedRect: CGRect(origin: .zero, size: size), cornerRadius: size.height / 2)

      context.fill(track, with: .color(.surface3))
      context.clip(to: track)
      context.fill(
        Path(CGRect(x: 0, y: 0, width: size.width * studied, height: size.height)),
        with: .color(.success))
      context.fill(
        Path(
          CGRect(
            x: size.width * studied, y: 0, width: size.width * known, height: size.height)),
        with: .color(CoverageLegend.knownColor))
    }
    .frame(height: 6)
    .accessibilityHidden(true)
  }
}

/// Main's `CoverageLegend`: what the coverage bar's parts are, in its order, each with its share
/// when `shares` is given. Without them the words beside the bar say the numbers, so VoiceOver
/// skips it.
struct CoverageLegend: View {
  struct Shares {
    let studied: Double
    let known: Double
    let new: Double
  }

  static let knownColor = Color.mutedForeground.opacity(0.7)

  var shares: Shares?

  var body: some View {
    // Rows that wrap like web's, so a large text size moves a part to the next line, never off the edge.
    let legend = FlowLayout(spacing: 12, rowSpacing: 4) {
      item(
        Text(
          LocalizedStringResource(
            "coverageStudied", defaultValue: "Studied", table: "Plan",
            comment: "Legend of a progress bar's part: the lessons studied")),
        share: shares?.studied
      ) {
        Circle().fill(.success)
      }

      item(
        Text(
          LocalizedStringResource(
            "coverageKnown", defaultValue: "Already knew", table: "Plan",
            comment: "Legend of a progress bar's part: the lessons the learner already knew")),
        share: shares?.known
      ) {
        Circle().fill(Self.knownColor)
      }

      item(
        Text(
          LocalizedStringResource(
            "coverageNew", defaultValue: "New", table: "Plan",
            comment: "Legend of a progress bar's part: the lessons still new to the learner")),
        share: shares?.new
      ) {
        Circle().strokeBorder(Self.knownColor, lineWidth: 1)
      }
    }
    .typeStyle(.small)
    .foregroundStyle(.mutedForeground)

    if shares == nil {
      legend.accessibilityHidden(true)
    } else {
      legend.accessibilityElement(children: .combine)
    }
  }

  private func item(_ label: Text, share: Double?, @ViewBuilder dot: () -> some View) -> some View {
    HStack(spacing: 6) {
      dot()
        .frame(width: 6, height: 6)

      label

      if let share {
        Text(share, format: .percent.precision(.fractionLength(0)))
          .typeFace(.mono)
          .foregroundStyle(Color(.foreground))
      }
    }
    .fixedSize()
  }
}
