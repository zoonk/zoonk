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
    case call(LiveCall.Failure, HelpLimit?)
    /// Saving found the call already ended, or taken over by another call.
    case saveEnded(takenOver: Bool)
  }

  let problem: Problem
  let onAction: (CallProblemAction) -> Void

  var body: some View {
    OpeningClock(availableAt: limit?.availableAt) { now in
      ContentUnavailableView {
        Label {
          title(now)
        } icon: {
          Image(systemName: symbol)
        }
      } description: {
        description(now)
      }
      .bottomBar {
        actions(now)
          .buttonStyle(.mainAction)
      }
    }
    .lonePage()
  }

  private var limit: HelpLimit? {
    if case .call(_, let limit) = problem {
      return limit
    }

    return nil
  }

  private var symbol: String {
    switch problem {
    case .call(.limit, _): "clock"
    case .call(.callsPaused, _): "pause.circle"
    case .call(.callInProgress, _): "phone.connection"
    default: "phone.down"
    }
  }

  private func title(_ now: Date) -> Text {
    switch problem {
    case .saveEnded: CallRefusal.title(.ended, limit: nil)
    case .call(let failure, let limit): CallRefusal.title(failure, limit: limit, now: now)
    }
  }

  private func description(_ now: Date) -> Text? {
    switch problem {
    case .saveEnded(takenOver: true):
      Text(
        "It ended when you started another call.", tableName: "Voice",
        comment: "Another call took this one over")
    case .saveEnded:
      CallRefusal.text(.ended, limit: nil)
    case .call(let failure, let limit):
      CallRefusal.text(failure, limit: limit, now: now)
    }
  }

  /// The screen's one way on, in its bottom bar; a gate's is "Subscribe" and the close button
  /// leaves. Once the cap's day has come, calling again asks the server.
  @ViewBuilder
  private func actions(_ now: Date) -> some View {
    switch problem {
    case .call(.callInProgress, _):
      Button {
        onAction(.takeover)
      } label: {
        CallRefusal.takeover
      }
    case .call(.connect, _), .call(.plusRequired, _),
      .call(.limit, _) where limit?.isOpen(at: now) == true:
      Button {
        onAction(.retry)
      } label: {
        Text("Try again", tableName: "Voice", comment: "Calls again")
      }
    case .call(.limit, let limit?) where limit.tier != .plus:
      CallLimitUpsell(limit: limit)
    default:
      Button {
        onAction(.back)
      } label: {
        Text("Back", tableName: "Voice", comment: "Leaves the call")
      }
    }
  }
}

/// A call that dropped can always be ended and saved, and called again when that can work.
struct DroppedCallView: View {
  @Environment(\.openURL) private var openURL

  let dropped: DroppedCall
  let limit: HelpLimit?
  /// Whom the learner talks with, for the microphone's explanation.
  let name: String
  let onAction: (CallProblemAction) -> Void

  var body: some View {
    OpeningClock(availableAt: limit?.availableAt) { now in
      ContentUnavailableView {
        Label {
          Text("The call dropped", tableName: "Voice", comment: "A live call lost its connection")
        } icon: {
          Image(systemName: "phone.down")
        }
      } description: {
        reason(now)
      } actions: {
        actions(now)
      }
    }
    .lonePage()
  }

  @ViewBuilder
  private func reason(_ now: Date) -> some View {
    switch dropped.reason {
    case nil:
      Text(
        "Call again, or end the call to get feedback on what you said.", tableName: "Voice",
        comment: "What to do after a call dropped")
    case .microphone:
      why(CallMicrophoneOff.title, CallMicrophoneOff.text(name: name))
    case .plusRequired:
      why(CallStartFooter.lockedTitle, CallStartFooter.lockedLine)
    case .callInProgress:
      refused(.callInProgress)
    case .callsPaused:
      refused(.callsPaused)
    case .ended:
      refused(.ended)
    case .limit:
      refused(.limit, now: now)
    }
  }

  @ViewBuilder
  private func actions(_ now: Date) -> some View {
    switch dropped.retryNow(limit: limit, at: now) {
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
      .buttonStyle(.outline)

      endButton
    case nil:
      CallMainButton {
        onAction(.end)
      } label: {
        endLabel
      }

      upsell
        .buttonStyle(.outline)
    }
  }

  @ViewBuilder
  private var upsell: some View {
    if dropped.reason == .plusRequired {
      SubscribeButton()
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
    .buttonStyle(.outline)
  }

  private var endLabel: Text {
    Text("End the call", tableName: "Voice", comment: "Ends a dropped call and saves it")
  }

  private func refused(_ failure: LiveCall.Failure, now: Date = .now) -> some View {
    why(
      CallRefusal.title(failure, limit: limit, now: now),
      CallRefusal.text(failure, limit: limit, now: now))
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
  static func title(_ failure: LiveCall.Failure, limit: HelpLimit?, now: Date = .now) -> Text {
    switch failure {
    case .ended:
      Text("This call has ended", tableName: "Voice", comment: "A call that can't go on")
    case .callsPaused:
      Text("Calls are paused", tableName: "Voice", comment: "Calls are off for everyone")
    case .callInProgress:
      Text("You're in another call", tableName: "Voice", comment: "Another call is open")
    case .limit:
      (limit ?? .limitReached(period: .day, tier: .plus)).words(.callTime, now: now).title
        .map(Text.init) ?? Text(verbatim: "")
    case .connect, .dropped, .plusRequired:
      Text("The call didn't connect", tableName: "Voice", comment: "A call that didn't start")
    }
  }

  static func text(_ failure: LiveCall.Failure, limit: HelpLimit?, now: Date = .now) -> Text? {
    switch failure {
    case .ended:
      Text("Start a new call to keep practicing.", tableName: "Voice", comment: "An ended call")
    case .callsPaused:
      Text(
        "It's the same for everyone right now. Try again later.", tableName: "Voice",
        comment: "Calls are paused for everyone")
    case .callInProgress:
      Text(
        "It's open in another tab or on another device. Starting this one ends it, without its feedback.",
        tableName: "Voice", comment: "Another call of the learner's is open")
    case .limit:
      limit?.words(.callTime, now: now).line.map(Text.init)
    case .connect, .dropped, .plusRequired:
      Text(
        "This happens sometimes. Try again in a moment.", tableName: "Voice",
        comment: "A call that didn't connect")
    }
  }

  static var takeover: Text {
    Text(
      "Start this call", tableName: "Voice",
      comment: "Ends the learner's other call and starts this one")
  }

}

/// More calls: a free account for a guest, a subscription for a free learner. A subscriber has no
/// more to offer.
private struct CallLimitUpsell: View {
  @Environment(AppRouter.self) private var router

  let limit: HelpLimit

  var body: some View {
    switch limit.tier {
    case .guest?:
      Button {
        router.present(.signIn)
      } label: {
        Text(
          "Create a free account", tableName: "Voice",
          comment: "Button to sign up after a guest used the free help")
      }
    case .free?:
      SubscribeButton()
    case .plus?, nil:
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
