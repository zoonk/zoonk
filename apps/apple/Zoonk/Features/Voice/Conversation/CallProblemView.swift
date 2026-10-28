import SwiftUI

/// Why the call can't go on (it didn't connect, it dropped, it ended, calls are paused, another
/// call is open, the plan's call time is used): one title and what to do, never the learner's
/// fault.
struct CallProblemView: View {
  @Environment(AppRouter.self) private var router
  enum Problem: Equatable {
    case call(LiveCall.Failure, CallLimit?)
    /// Saving found the call already ended, or taken over by another call.
    case saveEnded(takenOver: Bool)
  }

  enum Action {
    case retry
    case takeover
    case end
    case back
  }

  let problem: Problem
  let onAction: (Action) -> Void

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

  @ViewBuilder
  private var title: some View {
    switch problem {
    case .saveEnded, .call(.ended, _):
      Text("This call has ended", tableName: "Voice", comment: "A call that can't go on")
    case .call(.callsPaused, _):
      Text("Calls are paused", tableName: "Voice", comment: "Calls are off for everyone")
    case .call(.callInProgress, _):
      Text("You're already in a call", tableName: "Voice", comment: "Another call is open")
    case .call(.dropped, _):
      Text("The call dropped", tableName: "Voice", comment: "A live call lost its connection")
    case .call(.limit, let limit):
      switch limit?.period {
      case .month:
        Text(
          "No more calls this month", tableName: "Voice", comment: "The plan's call time is used")
      case .total:
        Text("Calls need a free account", tableName: "Voice", comment: "A guest can't call")
      default:
        Text("No more calls today", tableName: "Voice", comment: "The plan's call time is used")
      }
    case .call(.connect, _), .call(.plusRequired, _):
      Text("The call didn't connect", tableName: "Voice", comment: "A call that didn't start")
    }
  }

  @ViewBuilder
  private var description: some View {
    switch problem {
    case .saveEnded(let takenOver):
      if takenOver {
        Text(
          "It ended when you started another call.", tableName: "Voice",
          comment: "Another call took this one over")
      } else {
        Text("Start a new call to keep practicing.", tableName: "Voice", comment: "An ended call")
      }
    case .call(.ended, _):
      Text("Start a new call to keep practicing.", tableName: "Voice", comment: "An ended call")
    case .call(.callsPaused, _):
      Text(
        "It's the same for everyone right now. Try again later.", tableName: "Voice",
        comment: "Calls are paused for everyone")
    case .call(.callInProgress, _):
      Text(
        "It's open in another tab or on another device. Ending it from here skips its feedback.",
        tableName: "Voice", comment: "Another call of the learner's is open")
    case .call(.dropped, _):
      Text(
        "Call again, or end the call to get feedback on what you said.", tableName: "Voice",
        comment: "What to do after a call dropped")
    case .call(.limit, let limit):
      if let limit {
        CallLimitText(limit: limit)
      }
    case .call(.connect, _), .call(.plusRequired, _):
      Text(
        "This happens sometimes. Try again in a moment.", tableName: "Voice",
        comment: "A call that didn't connect")
    }
  }

  @ViewBuilder
  private var actions: some View {
    switch problem {
    case .call(.callInProgress, _):
      mainButton(.takeover) {
        Text("End that call and start this one", tableName: "Voice", comment: "Takes over a call")
      }
    case .call(.dropped, _):
      mainButton(.retry) {
        Text("Call again", tableName: "Voice", comment: "Calls again after a drop")
      }

      Button(role: .destructive) {
        onAction(.end)
      } label: {
        Text("End the call", tableName: "Voice", comment: "Ends a dropped call and saves it")
      }
      .buttonStyle(.bordered)
    case .call(.connect, _), .call(.plusRequired, _):
      mainButton(.retry) {
        Text("Try again", tableName: "Voice", comment: "Calls again")
      }
    case .call(.limit, let limit?) where limit.tier != .plus:
      // The one thing to do: a guest creates a free account, a free learner gets Plus.
      Group {
        if limit.tier == .guest {
          Button {
            router.present(.account)
          } label: {
            Text(
              "Create a free account", tableName: "Voice",
              comment: "Button to sign up after a guest used the free help")
          }
        } else {
          SeePlusButton()
        }
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)

      Button {
        onAction(.back)
      } label: {
        Text("Back", tableName: "Voice", comment: "Leaves the call")
      }
      .buttonStyle(.bordered)
    default:
      mainButton(.back) {
        Text("Back", tableName: "Voice", comment: "Leaves the call")
      }
    }
  }

  private func mainButton(_ action: Action, @ViewBuilder label: () -> some View) -> some View {
    Button {
      onAction(action)
    } label: {
      label()
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
  }
}

/// What the plan's call time being used means, as main's call limit notice says it: until when,
/// and never how much call time a plan has.
private struct CallLimitText: View {
  let limit: CallLimit

  var body: some View {
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

/// Saving a finished call: its feedback being written (an exam task's grade takes longer), or why
/// it wasn't saved yet, with a way to try again.
struct SavingCallView: View {
  @State private var isSlow = false

  let state: LiveCallSaveState
  let isGrading: Bool
  let onRetry: () -> Void

  var body: some View {
    switch state {
    case .closing, .failed:
      ContentUnavailableView {
        Label {
          if state == .closing {
            Text(
              "The call is still closing. Try again in a moment.", tableName: "Voice",
              comment: "The server hasn't confirmed the call ended")
          } else {
            Text("We couldn't save the call.", tableName: "Voice", comment: "Saving a call failed")
          }
        } icon: {
          Image(systemName: "exclamationmark.triangle")
        }
      } actions: {
        Button(action: onRetry) {
          Text("Try again", tableName: "Voice", comment: "Retries saving a call")
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
      }
    default:
      VStack(spacing: 16) {
        ProgressView()
        Text(line)
          .multilineTextAlignment(.center)
          .foregroundStyle(.secondary)
      }
      .scenePadding()
      .task {
        // Past this a save says it's still working: a call's feedback takes a few seconds, an
        // exam's grade about half a minute.
        try? await Task.sleep(for: .seconds(isGrading ? 45 : 20))
        isSlow = true
      }
    }
  }

  private var line: String {
    if isGrading {
      return isSlow
        ? String(
          localized: "Still rating your speaking. This is taking longer than usual.",
          table: "Voice",
          comment: "An exam task's grade takes long")
        : String(
          localized:
            "Rating your speaking on the exam's criteria. It usually takes about half a minute.",
          table: "Voice", comment: "An exam task is graded")
    }

    return isSlow
      ? String(
        localized: "Still writing your feedback. This is taking longer than usual.", table: "Voice",
        comment: "A call's feedback takes long")
      : String(
        localized: "Writing your feedback…", table: "Voice", comment: "A call's feedback is written"
      )
  }
}
