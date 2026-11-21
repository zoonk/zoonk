import SwiftUI
import UIKit

/// Main's `RecordButton`: a screen's main action, in its bottom bar. "Record" until the microphone
/// is on (busy while it's acquired), then "Stop" with the time.
struct RecordButton: View {
  let recorder: VoiceRecorder
  var isDisabled = false
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
        BusyButton(isBusy: recorder.status == .acquiring, action: onStart) {
          Text("Record", tableName: "Voice", comment: "Button that starts recording the learner")
        }
        .disabled(isDisabled)
      }
    }
    .buttonStyle(.mainAction)
    .keyboardShortcut(.defaultAction)
  }
}

/// A screen whose step records puts its Record button in the screen's bottom bar: the step hands
/// its recorder here, and the bar draws `RecordButton` in its main action's place. A bar that
/// `showsNote` also draws the recorder's line (`note`) right over itself, next to the Record it
/// talks about; elsewhere the recorder keeps its line under what the learner says.
@MainActor
@Observable
final class RecordInBar {
  let showsNote: Bool
  fileprivate(set) var recorder: VoiceRecorder?
  fileprivate(set) var isChecking = false
  fileprivate(set) var line: RecorderLine?
  @ObservationIgnored fileprivate var start: (() -> Void)?

  init(showsNote: Bool = false) {
    self.showsNote = showsNote
  }

  var button: RecordButton? {
    guard let recorder, let start else {
      return nil
    }

    return RecordButton(recorder: recorder, isDisabled: isChecking, onStart: start)
  }

  var note: BarNote? {
    guard showsNote, let line else {
      return nil
    }

    return BarNote(line.text, tone: line.tone)
  }
}

/// What a recorder says about its take: what Record or Stop does, the check, or what went wrong.
struct RecorderLine: Equatable {
  let text: String
  let tone: BarNote.Tone
}

extension View {
  /// Hands `recorder` and its `line` to the screen's bottom bar while this view shows.
  func recordsInBar(
    _ bar: RecordInBar?, recorder: VoiceRecorder, isChecking: Bool, line: RecorderLine?,
    start: @escaping () -> Void
  ) -> some View {
    onAppear {
      bar?.recorder = recorder
      bar?.start = start
    }
    .onChange(of: isChecking, initial: true) { _, value in bar?.isChecking = value }
    .onChange(of: line, initial: true) { _, value in bar?.line = value }
    // A step removed in the update that ends its check never sends that change, so its checking
    // and its line go with its recorder.
    .onDisappear {
      if bar?.recorder === recorder {
        bar?.recorder = nil
        bar?.start = nil
        bar?.isChecking = false
        bar?.line = nil
      }
    }
  }
}

struct MicrophoneOffView<Actions: View>: View {
  @Environment(\.openURL) private var openURL
  let description: Text
  @ViewBuilder let actions: Actions

  var body: some View {
    StateMessage {
      Label {
        Text(
          "The microphone is off", tableName: "Voice",
          comment: "Title when the learner turned off the microphone for the app")
      } icon: {
        Image(systemName: "mic.slash")
      }
    } description: {
      description
    } actions: {
      Button {
        if let url = URL(string: UIApplication.openSettingsURLString) {
          openURL(url)
        }
      } label: {
        Text("Open Settings", tableName: "Voice", comment: "Button that opens the app's settings")
      }
      .buttonStyle(.outline)

      actions
    }
  }
}
