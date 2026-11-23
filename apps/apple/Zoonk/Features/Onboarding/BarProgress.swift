import SwiftUI

/// Main's bar middle in setup and its tests (`onboarding-bar.tsx`): how far the learner is, where
/// a title would sit.
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

/// Main's `TestProgress`: the share of a test answered, in the dashes' place.
struct TestProgressBar: View {
  /// From 0 to 1.
  let value: Double

  var body: some View {
    Meter(value: value, fill: Color(.foreground), height: 4)
      .frame(width: barProgressWidth)
      .accessibilityLabel(Text("Questions answered", tableName: "Onboarding"))
  }
}

/// The share of a test answered while one of its questions shows. The question can't put it in the
/// bar itself: a bar whose title is removed has no principal slot, so the bar's owner draws it.
struct TestQuestionProgressKey: PreferenceKey {
  static let defaultValue: Double? = nil

  static func reduce(value: inout Double?, nextValue: () -> Double?) {
    value = nextValue() ?? value
  }
}

extension View {
  /// A test's bar: no title, since each screen's chip names the test (the title stays for VoiceOver
  /// and window names), and while a question shows, how far the test is in the title's place.
  func testBar() -> some View {
    modifier(TestBar())
  }
}

private struct TestBar: ViewModifier {
  @State private var progress: Double?

  func body(content: Content) -> some View {
    content
      .onPreferenceChange(TestQuestionProgressKey.self) { progress = $0 }
      .toolbar(removing: progress == nil ? .title : nil)
      .toolbar {
        if let progress {
          ToolbarItem(placement: .principal) {
            TestProgressBar(value: progress)
          }
        }
      }
  }
}
