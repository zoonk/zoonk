import SwiftUI

/// Main's bar middle in setup (`onboarding-bar.tsx`): how far the learner is, where a title would
/// sit.
private let barProgressWidth = 96.0

/// Main's `StepDots`: a dash per setup question, those done faint and the current one in ink.
struct StepDashes: View {
  let progress: SetupProgress

  var body: some View {
    MeterParts(
      parts: (1...max(progress.total, 1)).map { step in
        MeterParts.Part(
          fill: step < progress.step
            ? .color(Color(.foreground).opacity(0.25))
            : step == progress.step ? .color(Color(.foreground)) : .track)
      },
      height: 4, gap: 3
    )
    .frame(width: barProgressWidth)
    .accessibilityElement()
    .accessibilityLabel(
      Text(
        "Step \(progress.step) of \(progress.total)", tableName: "Onboarding",
        comment: "Where the learner is among the goal's questions"))
  }
}
