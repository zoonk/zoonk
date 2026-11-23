import SwiftUI
import UIKit

/// Main's `RecordButton`: a screen's main action, in its bottom bar. "Record" until the microphone
/// is on (busy while it's acquired), then "Stop" with the time, and busy again while the take is
/// checked.
struct RecordButton: View {
  let recorder: VoiceRecorder
  var isChecking = false
  let onStart: () -> Void

  var body: some View {
    Group {
      if case .recording(let startedAt) = recorder.status {
        Button {
          recorder.stop()
        } label: {
          HStack(spacing: 8) {
            Text("Stop", tableName: "Voice", comment: "Button that stops recording the learner")
            // The clock moves every second, so it stays out of the button's name.
            PlanDate.stopwatch(
              from: startedAt, to: startedAt.addingTimeInterval(VoiceRecorder.maxDuration)
            )
            .monospacedDigit()
            .opacity(0.7)
            .accessibilityHidden(true)
          }
        }
        .accessibilityAddTraits(.isSelected)
      } else {
        BusyButton(isBusy: recorder.status == .acquiring || isChecking, action: onStart) {
          Text("Record", tableName: "Voice", comment: "Button that starts recording the learner")
        }
      }
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
  }
}

/// A screen whose step records puts its Record button in the screen's bottom bar: the step hands
/// its recorder here, and the bar draws `RecordButton` in its main action's place and the
/// recorder's line (`note`) right over itself, next to the Record it talks about.
@MainActor
@Observable
final class RecordInBar {
  fileprivate(set) var recorder: VoiceRecorder?
  fileprivate(set) var isChecking = false
  /// False while the microphone is off on a screen whose other way on is to skip.
  fileprivate(set) var canRecord = true
  fileprivate(set) var line: RecordNote?
  @ObservationIgnored fileprivate var start: (() -> Void)?

  var button: RecordButton? {
    guard canRecord, let recorder, let start else {
      return nil
    }

    return RecordButton(recorder: recorder, isChecking: isChecking, onStart: start)
  }

  var note: BarNote? {
    line?.note
  }
}

/// Main's `RecordNote`: the one line about recording, right over Record, in the same words on every
/// screen that records. A check that isn't slow yet has none: Record's busy button says it.
enum RecordNote: Equatable {
  case ready
  case acquiring
  /// Not read as it shows: VoiceOver's speech would end up in the take.
  case recording
  case noSpeech
  case failed
  case slow
  /// The microphone is off where skipping is the other way on: how to turn it back on.
  case microphoneOff(String)

  init?(active status: VoiceRecorder.Status) {
    switch status {
    case .acquiring: self = .acquiring
    case .recording: self = .recording
    case .idle, .denied: return nil
    }
  }

  @MainActor
  var note: BarNote {
    switch self {
    case .ready:
      BarNote(
        LocalizedStringResource(
          "Tap Record and say it out loud", table: "Voice",
          comment: "Asks the learner to record their answer"), tone: .status)
    case .acquiring:
      BarNote(LocalizedStringResource("Getting ready…", table: "Today"), tone: .hint)
    case .recording:
      BarNote(
        LocalizedStringResource(
          "Listening… Tap Stop to check.", table: "Voice",
          comment: "Shown while the learner records an answer"), tone: .hint)
    case .noSpeech:
      BarNote(
        LocalizedStringResource(
          "We couldn't hear any words. Try again.", table: "Voice",
          comment: "A recording had no words in it"), tone: .waiting)
    case .failed:
      BarNote(
        LocalizedStringResource(
          "We couldn't check your answer this time. Try again.", table: "Voice",
          comment: "Grading a spoken answer failed"))
    case .slow:
      BarNote(
        LocalizedStringResource(
          "Still checking. This is taking longer than usual.", table: "Voice",
          comment: "Grading a spoken answer is taking longer than usual"), tone: .status)
    case .microphoneOff(let line):
      BarNote(
        line, tone: .status,
        action: BarNote.Action(
          label: Text(
            "Open Settings", tableName: "Voice", comment: "Button that opens the app's settings")
        ) {
          if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
          }
        })
    }
  }
}

extension View {
  /// Hands `recorder` and its `note` to the screen's bottom bar while this view shows; the bar
  /// offers Record only while `canRecord`.
  func recordsInBar(
    _ bar: RecordInBar?, recorder: VoiceRecorder, isChecking: Bool, note: RecordNote?,
    canRecord: Bool = true, start: @escaping () -> Void
  ) -> some View {
    onAppear {
      bar?.recorder = recorder
      bar?.start = start
    }
    .onChange(of: isChecking, initial: true) { _, value in bar?.isChecking = value }
    .onChange(of: canRecord, initial: true) { _, value in bar?.canRecord = value }
    .onChange(of: note, initial: true) { _, value in bar?.line = value }
    // A step removed in the update that ends its check never sends that change, so its checking
    // and its line go with its recorder.
    .onDisappear {
      if bar?.recorder === recorder {
        bar?.recorder = nil
        bar?.start = nil
        bar?.isChecking = false
        bar?.canRecord = true
        bar?.line = nil
      }
    }
  }

  /// Sets `isSlow` once a check has run longer than one should (main's `CHECK_BOUNDS.slowMs`), and
  /// back as it starts again or ends.
  func slowCheck(_ isChecking: Bool, isSlow: Binding<Bool>) -> some View {
    task(id: isChecking) {
      isSlow.wrappedValue = false

      if isChecking {
        try? await Task.sleep(for: LessonGrading.slowCheck)
        isSlow.wrappedValue = !Task.isCancelled
      }
    }
  }
}
