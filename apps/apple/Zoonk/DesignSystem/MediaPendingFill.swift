import SwiftUI

/// Holds the place of a picture or a voice message that's still being made. Only the fill pulses,
/// so what's written over it stays readable.
struct MediaPendingFill: View {
  var pulses = true

  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    let shape = Rectangle().fill(.fill.tertiary)

    if pulses, !reduceMotion {
      shape.phaseAnimator([false, true]) { content, isDim in
        content.opacity(isDim ? 0.4 : 1)
      } animation: { _ in
        .easeInOut(duration: 1)
      }
    } else {
      shape
    }
  }
}
