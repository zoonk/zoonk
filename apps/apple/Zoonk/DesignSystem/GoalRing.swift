import SwiftUI

enum GoalRingTrack {
  case standard
  /// A study day gone by without study.
  case missed
  case rest
  case today
}

/// Main's `GoalRing`: a day's ring, filled in `success` by the share of its goal studied, over a
/// track that says what kind of day it was, with a mark inside.
struct GoalRing<Mark: View>: View {
  /// From 0 to 1.
  let share: Double
  var track = GoalRingTrack.standard
  let size: CGFloat
  @ViewBuilder let mark: Mark

  var body: some View {
    let lineWidth = size / 12

    ZStack {
      Circle()
        .stroke(
          .primary.opacity(trackOpacity),
          style: StrokeStyle(
            lineWidth: lineWidth, dash: track == .missed ? [lineWidth, lineWidth] : []))

      if share > 0 {
        Circle()
          .trim(from: 0, to: min(1, share))
          .stroke(.success, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
          .rotationEffect(.degrees(-90))
      }

      mark
        .typeStyle(.small.bold())
    }
    .padding(lineWidth / 2)
    .frame(width: size, height: size)
  }

  private var trackOpacity: Double {
    switch track {
    case .standard: 0.1
    case .missed, .today: 0.25
    case .rest: 0.06
    }
  }
}
