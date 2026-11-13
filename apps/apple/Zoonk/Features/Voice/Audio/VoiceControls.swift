import SwiftUI
import UIKit

struct RecordButton: View {
  let recorder: VoiceRecorder
  var isDisabled = false
  let onStart: () -> Void

  var body: some View {
    if case .recording(let startedAt) = recorder.status {
      Button {
        recorder.stop()
      } label: {
        Label {
          HStack(spacing: 8) {
            Text("Stop", tableName: "Voice", comment: "Button that stops recording the learner")
            // The clock moves every second, so it stays out of the button's name.
            Text(
              timerInterval: startedAt...startedAt.addingTimeInterval(VoiceRecorder.maxDuration),
              countsDown: false
            )
            .monospacedDigit()
            .foregroundStyle(.mutedForeground)
            .accessibilityHidden(true)
          }
        } icon: {
          Image(systemName: "stop.fill")
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.outline)
      .controlSize(.large)
      .overlay(alignment: .trailing) {
        LevelMeter(level: recorder.level)
          .padding(.trailing)
      }
    } else {
      Button(action: onStart) {
        Label {
          Text("Record", tableName: "Voice", comment: "Button that starts recording the learner")
        } icon: {
          Image(systemName: "mic.fill")
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .disabled(isDisabled || recorder.status == .acquiring)
    }
  }
}

struct LevelMeter: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  let level: Double

  var body: some View {
    Image(systemName: "waveform", variableValue: reduceMotion ? 1 : level)
      .foregroundStyle(.mutedForeground)
      .accessibilityHidden(true)
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
