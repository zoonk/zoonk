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
            Text(
              timerInterval: startedAt...startedAt.addingTimeInterval(VoiceRecorder.maxDuration),
              countsDown: false
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
/// its recorder here, and the bar draws `RecordButton` in its main action's place.
@MainActor
@Observable
final class RecordInBar {
  fileprivate(set) var recorder: VoiceRecorder?
  fileprivate(set) var isChecking = false
  @ObservationIgnored fileprivate var start: (() -> Void)?

  var button: RecordButton? {
    guard let recorder, let start else {
      return nil
    }

    return RecordButton(recorder: recorder, isDisabled: isChecking, onStart: start)
  }
}

extension View {
  /// Hands `recorder` to the screen's bottom bar while this view shows.
  func recordsInBar(
    _ bar: RecordInBar?, recorder: VoiceRecorder, isChecking: Bool, start: @escaping () -> Void
  ) -> some View {
    onAppear {
      bar?.recorder = recorder
      bar?.start = start
    }
    .onChange(of: isChecking, initial: true) { _, value in bar?.isChecking = value }
    .onDisappear {
      if bar?.recorder === recorder {
        bar?.recorder = nil
        bar?.start = nil
      }
    }
  }
}

struct MicrophoneOffView<Actions: View>: View {
  @Environment(\.openURL) private var openURL
  let description: Text
  @ViewBuilder let actions: Actions

  var body: some View {
    ContentUnavailableView {
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
