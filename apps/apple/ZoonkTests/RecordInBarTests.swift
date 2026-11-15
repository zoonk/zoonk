import SwiftUI
import XCTest

@testable import Zoonk

/// The bar's Record is a step's, so what it says about checking ends with the step.
@MainActor
final class RecordInBarTests: XCTestCase {
  /// Grading a spoken answer ends its check and moves on in one update, which removes the step: the
  /// next step's main action mustn't stay busy.
  func testAStepRemovedAsItsCheckEndsLeavesTheBarFree() async throws {
    let bar = RecordInBar()
    let step = SpokenStep()

    try show(SpokenStepHost(step: step, bar: bar))
    try await Task.sleep(for: .seconds(0.3))

    step.isChecking = true
    try await Task.sleep(for: .seconds(0.3))
    XCTAssertTrue(bar.isChecking)

    step.isChecking = false
    step.isShown = false
    try await Task.sleep(for: .seconds(0.3))

    XCTAssertNil(bar.button)
    XCTAssertFalse(bar.isChecking)
  }
}

@MainActor @Observable
private final class SpokenStep {
  var isShown = true
  var isChecking = false
  let recorder = VoiceRecorder()
}

private struct SpokenStepHost: View {
  let step: SpokenStep
  let bar: RecordInBar

  var body: some View {
    if step.isShown {
      Text(verbatim: "Say it out loud")
        .recordsInBar(bar, recorder: step.recorder, isChecking: step.isChecking, start: {})
    }
  }
}
