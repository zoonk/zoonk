import SwiftUI

/// Main's `BeltTicks`: a belt's ten levels, the new one filling when the moment plays.
struct BeltTicks: View {
  let belt: ProgressBelt
  let level: Int
  var fillsNewLevel = false
  var delay: TimeInterval = 0

  private static let levelsPerBelt = 10

  /// A white tick would vanish on the page, so it's ink.
  private var tick: Color {
    belt == .white ? .primary.opacity(0.7) : belt.color
  }

  var body: some View {
    HStack(spacing: 2) {
      ForEach(0..<Self.levelsPerBelt, id: \.self) { index in
        MeterSegment(
          share: index < level ? 1 : 0, from: fillsNewLevel && index == level - 1 ? 0 : nil,
          color: tick, delay: delay)
      }
    }
    .frame(height: 6)
    .accessibilityHidden(true)
  }
}

/// Main's `LevelBadge`: the level's number on its belt's color.
struct LevelBadge: View {
  let belt: ProgressBelt
  let level: Int

  @ScaledMetric(relativeTo: .body) private var size = 40.0

  private var isLight: Bool {
    [.white, .yellow, .orange].contains(belt)
  }

  var body: some View {
    Text(level, format: .number)
      .font(.body.weight(.semibold).monospacedDigit())
      .foregroundStyle(isLight ? Color.black.opacity(0.8) : .white)
      .frame(width: size, height: size)
      .background(belt.color, in: .circle)
      .overlay {
        Circle().strokeBorder(.primary.opacity(0.1))
      }
      .accessibilityHidden(true)
  }
}
