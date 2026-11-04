import SwiftUI
import UIKit

/// What the learner chose on a call's problem screen or the dropped one.
enum CallProblemAction {
  case retry
  case takeover
  case type
  case end
  case back
}

/// One title and what to do, never the learner's fault.
struct CallProblemView: View {
  enum Problem: Equatable {
    case call(LiveCall.Failure, CallLimit?)
    /// Saving found the call already ended, or taken over by another call.
    case saveEnded(takenOver: Bool)
  }

  let problem: Problem
  let onAction: (CallProblemAction) -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        title
      } icon: {
        Image(systemName: symbol)
      }
    } description: {
      description
    } actions: {
      actions
    }
  }

  private var symbol: String {
    switch problem {
    case .call(.limit, _): "clock"
    case .call(.callsPaused, _): "pause.circle"
    case .call(.callInProgress, _): "phone.connection"
    default: "phone.down"
    }
  }

  private var title: Text {
    switch problem {
    case .saveEnded: CallRefusal.title(.ended, limit: nil)
    case .call(let failure, let limit): CallRefusal.title(failure, limit: limit)
    }
  }

  private var description: Text? {
    switch problem {
    case .saveEnded(takenOver: true):
      Text(
        "It ended when you started another call.", tableName: "Voice",
        comment: "Another call took this one over")
    case .saveEnded:
      CallRefusal.text(.ended, limit: nil)
    case .call(let failure, let limit):
      CallRefusal.text(failure, limit: limit)
    }
  }

  @ViewBuilder
  private var actions: some View {
    switch problem {
    case .call(.callInProgress, _):
      CallMainButton {
        onAction(.takeover)
      } label: {
        CallRefusal.takeover
      }
    case .call(.connect, _), .call(.plusRequired, _):
      CallMainButton {
        onAction(.retry)
      } label: {
        Text("Try again", tableName: "Voice", comment: "Calls again")
      }
    case .call(.limit, let limit?) where limit.tier != .plus:
      CallLimitUpsell(limit: limit)
        .buttonStyle(.mainAction)
        .controlSize(.large)

      backButton
        .buttonStyle(.bordered)
    default:
      backButton
        .buttonStyle(.mainAction)
        .controlSize(.large)
    }
  }

  private var backButton: some View {
    Button {
      onAction(.back)
    } label: {
      Text("Back", tableName: "Voice", comment: "Leaves the call")
    }
  }
}

/// A call that dropped can always be ended and saved, and called again when that can work.
struct DroppedCallView: View {
  @Environment(\.openURL) private var openURL

  let dropped: DroppedCall
  let limit: CallLimit?
  /// Whom the learner talks with, for the microphone's explanation.
  let name: String
  let onAction: (CallProblemAction) -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text("The call dropped", tableName: "Voice", comment: "A live call lost its connection")
      } icon: {
        Image(systemName: "phone.down")
      }
    } description: {
      reason
    } actions: {
      actions
    }
  }

  @ViewBuilder
  private var reason: some View {
    switch dropped.reason {
    case nil:
      Text(
        "Call again, or end the call to get feedback on what you said.", tableName: "Voice",
        comment: "What to do after a call dropped")
    case .microphone:
      why(CallMicrophoneOff.title, CallMicrophoneOff.text(name: name))
    case .plusRequired:
      why(
        Text(
          "Available with Plus", tableName: "Subscriptions",
          comment: "Title of the notice on a feature the learner's plan doesn't include"),
        CallStartFooter.plusRequired)
    case .callInProgress:
      refused(.callInProgress)
    case .callsPaused:
      refused(.callsPaused)
    case .ended:
      refused(.ended)
    case .limit:
      refused(.limit)
    }
  }

  @ViewBuilder
  private var actions: some View {
    switch dropped.retry {
    case .callAgain:
      CallMainButton {
        onAction(.retry)
      } label: {
        Text("Call again", tableName: "Voice", comment: "Calls again after a drop")
      }

      endButton
    case .takeover:
      CallMainButton {
        onAction(.takeover)
      } label: {
        CallRefusal.takeover
      }

      endButton
    case .microphone:
      CallMainButton {
        onAction(.type)
      } label: {
        Text("Type instead", tableName: "Voice", comment: "Does the call by typing")
      }

      Button {
        if let url = URL(string: UIApplication.openSettingsURLString) {
          openURL(url)
        }
      } label: {
        Text("Open Settings", tableName: "Voice", comment: "Button that opens the app's settings")
      }
      .buttonStyle(.bordered)

      endButton
    case nil:
      CallMainButton {
        onAction(.end)
      } label: {
        endLabel
      }

      upsell
        .buttonStyle(.bordered)
    }
  }

  @ViewBuilder
  private var upsell: some View {
    if dropped.reason == .plusRequired {
      SeePlusButton()
    } else if dropped.reason == .limit, let limit {
      CallLimitUpsell(limit: limit)
    }
  }

  private var endButton: some View {
    Button(role: .destructive) {
      onAction(.end)
    } label: {
      endLabel
    }
    .buttonStyle(.bordered)
  }

  private var endLabel: Text {
    Text("End the call", tableName: "Voice", comment: "Ends a dropped call and saves it")
  }

  private func refused(_ failure: LiveCall.Failure) -> some View {
    why(CallRefusal.title(failure, limit: limit), CallRefusal.text(failure, limit: limit))
  }

  /// Under the screen's own title.
  private func why(_ title: Text, _ text: Text?) -> some View {
    VStack(spacing: 4) {
      title
        .typeStyle(.body.weight(.semibold))
        .foregroundStyle(.primary)

      text
    }
  }
}

/// Each refusal's words, on its own screen or as why a dropped call can't go on.
private enum CallRefusal {
  static func title(_ failure: LiveCall.Failure, limit: CallLimit?) -> Text {
    switch failure {
    case .ended:
      Text("This call has ended", tableName: "Voice", comment: "A call that can't go on")
    case .callsPaused:
      Text("Calls are paused", tableName: "Voice", comment: "Calls are off for everyone")
    case .callInProgress:
      Text("You're already in a call", tableName: "Voice", comment: "Another call is open")
    case .limit:
      switch limit?.period {
      case .month:
        Text(
          "No more calls this month", tableName: "Voice", comment: "The plan's call time is used")
      case .total:
        Text("Calls need a free account", tableName: "Voice", comment: "A guest can't call")
      default:
        Text("No more calls today", tableName: "Voice", comment: "The plan's call time is used")
      }
    case .connect, .dropped, .plusRequired:
      Text("The call didn't connect", tableName: "Voice", comment: "A call that didn't start")
    }
  }

  static func text(_ failure: LiveCall.Failure, limit: CallLimit?) -> Text? {
    switch failure {
    case .ended:
      Text("Start a new call to keep practicing.", tableName: "Voice", comment: "An ended call")
    case .callsPaused:
      Text(
        "It's the same for everyone right now. Try again later.", tableName: "Voice",
        comment: "Calls are paused for everyone")
    case .callInProgress:
      Text(
        "It's open in another tab or on another device. Ending it from here skips its feedback.",
        tableName: "Voice", comment: "Another call of the learner's is open")
    case .limit:
      limit.map(limitText)
    case .connect, .dropped, .plusRequired:
      Text(
        "This happens sometimes. Try again in a moment.", tableName: "Voice",
        comment: "A call that didn't connect")
    }
  }

  static var takeover: Text {
    Text("End that call and start this one", tableName: "Voice", comment: "Takes over a call")
  }

  /// Never says how much call time a plan has.
  private static func limitText(_ limit: CallLimit) -> Text {
    switch (limit.tier, limit.period) {
    case (.guest, _):
      Text(
        "Speaking calls come with a free account. Create one to practice out loud.",
        tableName: "Voice",
        comment: "A guest's plan has no calls")
    case (.plus, .month):
      Text(
        "Your calls come back next month.", tableName: "Voice",
        comment: "A Plus learner used this month's call time")
    case (.plus, _):
      Text(
        "Your calls come back tomorrow.", tableName: "Voice",
        comment: "A Plus learner used today's call time")
    case (.free, .month):
      Text(
        "Your calls come back next month, or get Plus for higher call limits.",
        tableName: "Voice", comment: "A free learner used this month's call time")
    case (.free, _):
      Text(
        "Your calls come back tomorrow, or get Plus for higher call limits.",
        tableName: "Voice", comment: "A free learner used today's call time")
    }
  }
}

/// More calls: a free account for a guest, Plus for a free learner. Plus has no more to offer.
private struct CallLimitUpsell: View {
  @Environment(AppRouter.self) private var router

  let limit: CallLimit

  var body: some View {
    switch limit.tier {
    case .guest:
      Button {
        router.present(.signIn)
      } label: {
        Text(
          "Create a free account", tableName: "Voice",
          comment: "Button to sign up after a guest used the free help")
      }
    case .free:
      SeePlusButton()
    case .plus:
      EmptyView()
    }
  }
}

private struct CallMainButton<Title: View>: View {
  let action: () -> Void
  @ViewBuilder let label: Title

  var body: some View {
    Button(action: action) {
      label
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
  }
}
