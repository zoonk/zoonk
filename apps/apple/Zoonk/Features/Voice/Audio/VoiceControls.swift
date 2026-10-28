import SwiftUI
import UIKit

/// The one way to say something out loud: Record, then Stop with how long it's been, while a
/// level meter shows the microphone hears the learner. A screen's main action.
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
            Text(timerInterval: startedAt...startedAt.addingTimeInterval(VoiceRecorder.maxDuration))
              .monospacedDigit()
              .foregroundStyle(.secondary)
              .accessibilityHidden(true)
          }
        } icon: {
          Image(systemName: "stop.fill")
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.bordered)
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

/// How loud the microphone hears the learner, as the waveform symbol filling up. With Reduce
/// Motion it stays still.
struct LevelMeter: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  let level: Double

  var body: some View {
    Image(systemName: "waveform", variableValue: reduceMotion ? 1 : level)
      .foregroundStyle(.secondary)
      .accessibilityHidden(true)
  }
}

/// Why help didn't come, in one sentence, and the one thing to do about it: a guest creates a free
/// account, a free learner gets Plus; Plus and a short break just wait. Port of main's
/// `HelpLimitNotice`.
struct HelpLimitNotice: View {
  let limit: HelpLimit
  /// Opens the account sheet (create an account) or the subscription (See Plus).
  var onAccount: (() -> Void)?
  var onPlus: (() -> Void)?

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(message)
        .font(.subheadline)
        .foregroundStyle(.secondary)

      if limit.needsAccount, let onAccount {
        Button(action: onAccount) {
          Text(
            "Create a free account", tableName: "Voice",
            comment: "Button to sign up after a guest used the free help")
        }
        .buttonStyle(.bordered)
      } else if limit.offersPlus, let onPlus {
        Button(action: onPlus) {
          Text("See Plus", tableName: "Voice", comment: "Button that opens the Plus subscription")
        }
        .buttonStyle(.bordered)
      }
    }
  }

  private var message: String {
    switch limit {
    case .slowDown:
      return String(
        localized: "Take a short break, then try again.", table: "Voice",
        comment: "Fair use asks the learner to wait a moment before more help")
    case .signUpRequired:
      return String(
        localized: "Create your free account to continue.", table: "Voice",
        comment: "A guest must create an account to keep getting help")
    case .limitReached(let period, let tier):
      let thisMonth = period != .day

      switch tier {
      case .guest:
        return thisMonth
          ? String(
            localized:
              "You've used the free help you can get without an account. Create a free account to keep going.",
            table: "Voice", comment: "A guest used all the help available without an account")
          : String(
            localized: "You've used today's free help. Create a free account to keep going.",
            table: "Voice", comment: "A guest used today's free help")
      case .plus:
        return String(
          localized: "You've used today's help. It comes back tomorrow.", table: "Voice",
          comment: "A Plus learner used today's help")
      case .free:
        return thisMonth
          ? String(
            localized:
              "You've used this month's help. It comes back next month, or get Plus to keep going now.",
            table: "Voice", comment: "A free learner used this month's help")
          : String(
            localized:
              "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
            table: "Voice", comment: "A free learner used today's help")
      }
    }
  }
}

/// The microphone is off for Zoonk: how to turn it on, and what to do meanwhile.
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
      .buttonStyle(.bordered)

      actions
    }
  }
}
