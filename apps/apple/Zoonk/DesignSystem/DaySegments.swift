import SwiftUI

/// Main's day segments: one equal part per block of the day, so the meter, the count and the
/// percent beside it say the same thing.
struct DaySegments: View {
  enum Segment: Equatable {
    case done
    case current
    case ahead
    /// A block that isn't a lesson, waiting in its kind's color.
    case kind(Color)
  }

  static let height = 6.0
  static let gap = 2.0

  let segments: [Segment]
  /// The block that just finished, which fills from empty on the moment's first beat.
  var finished: Int?

  var body: some View {
    HStack(spacing: Self.gap) {
      ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
        mark(segment, fills: index == finished)
      }
    }
    .frame(height: Self.height)
    .accessibilityHidden(true)
  }

  @ViewBuilder
  private func mark(_ segment: Segment, fills: Bool) -> some View {
    let shape = RoundedRectangle(cornerRadius: 3, style: .continuous)

    switch segment {
    case .done: MeterSegment(share: 1, from: fills ? 0 : nil, color: .success)
    case .current: shape.strokeBorder(.success, lineWidth: 1.5)
    case .ahead: shape.fill(Color.surface3)
    case .kind(let color): shape.fill(color.opacity(0.35))
    }
  }
}
