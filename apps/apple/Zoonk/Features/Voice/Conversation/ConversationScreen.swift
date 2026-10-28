import SwiftUI

/// A live conversation from its intro to its result: a unit's practice call, a language goal's
/// checkpoint, an IELTS or TOEFL speaking mock, or a task of a DELE, DELF, Goethe or Cambridge
/// speaking paper. A call that already ended opens on its result.
struct ConversationScreen: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(\.dismiss) private var dismiss
  @State private var conversation: Resource<LanguageConversation>?
  /// A call in progress can't be swiped away: End hangs it up and saves it.
  @State private var isInCall = false
  /// What the call just saved did to the learner's day, for its result.
  @State private var day: DayResult?

  let conversationId: String
  /// A running mock's speaking task goes back to the mock once its call is saved, without the
  /// call's own result: the mock's result reads it.
  var onSaved: (() -> Void)? = nil

  var body: some View {
    NavigationStack {
      Group {
        if let conversation {
          content(conversation)
            .loads(conversation, refreshable: false)
        }
      }
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        if !isInCall {
          ToolbarItem(placement: .cancellationAction) {
            Button(role: .close) {
              dismiss()
            }
          }
        }
      }
    }
    .interactiveDismissDisabled(isInCall)
    .onAppear {
      conversation =
        conversation
        ?? voice.cache.resource(audience: .signedIn) {
          [api = voice.liveCalls, conversationId] session in
          guard let session else {
            return nil
          }

          return try await api.conversation(id: conversationId, token: session.bearerToken)
        }
    }
  }

  @ViewBuilder
  private func content(_ resource: Resource<LanguageConversation>) -> some View {
    switch resource.state {
    case .idle, .loading:
      ProgressView()
    case .empty, .failed(.notFound):
      ContentUnavailableView {
        Label {
          Text(
            "This call isn't here", tableName: "Voice", comment: "A conversation that doesn't exist"
          )
        } icon: {
          Image(systemName: "phone.badge.waveform")
        }
      }
    case .failed:
      ContentUnavailableView {
        Label {
          Text("The call didn't load", tableName: "Voice", comment: "Loading a conversation failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await resource.refresh() }
        } label: {
          Text("Try again", tableName: "Voice", comment: "Button to retry loading")
        }
        .buttonStyle(.bordered)
      }
    case .loaded(let value):
      if value.result != nil {
        ConversationResultView(conversation: value, day: day)
          .navigationTitle(ConversationTitle(conversation: value).text)
      } else {
        LiveCallRun(conversation: value, isInCall: $isInCall) { saved in
          if let onSaved {
            onSaved()
            return
          }

          // The saved call's result, with its feedback, replaces the run.
          day = saved
          await resource.refresh()
        }
        .navigationTitle(ConversationTitle(conversation: value).text)
      }
    }
  }
}

/// Where saving a finished call stands.
enum LiveCallSaveState: Equatable {
  case saving
  case closing
  case failed
  case ended
  case takenOver
}

/// What kind of call this is, as the header says it; an exam task names its exam ("DELE B2").
struct ConversationTitle {
  let conversation: LanguageConversation

  var text: Text {
    if let exam = conversation.mockExam {
      return switch exam {
      case .ielts:
        Text("IELTS speaking mock", tableName: "Voice", comment: "A speaking mock's name")
      case .toefl:
        Text("TOEFL speaking mock", tableName: "Voice", comment: "A speaking mock's name")
      }
    }

    if let examTask = conversation.speakingTask {
      return Text(examTask.title)
    }

    if conversation.kind == .checkpoint {
      return Text("Unit challenge", tableName: "Voice", comment: "A checkpoint call's title")
    }

    return Text("Practice call", tableName: "Voice", comment: "A practice call's title")
  }
}

/// One call from the first ring to hanging up, then saved once with what was said. "Try again"
/// and a takeover start a fresh run that calls right away.
private struct LiveCallRun: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(\.dismiss) private var dismiss
  @State private var call: LiveCall?
  @State private var saving: LiveCallSaveState?
  @State private var usedHelp = false
  @State private var callsRightAway = false

  let conversation: LanguageConversation
  @Binding var isInCall: Bool
  let onSaved: (DayResult?) async -> Void

  var body: some View {
    Group {
      if let call {
        runView(call)
      } else {
        // Something to appear, so the call is made.
        Color.clear
      }
    }
    .onAppear { makeCall() }
    .onDisappear {
      call?.leave()
      isInCall = false
    }
    .onChange(of: call?.phase) { _, phase in
      isInCall = phase == .connecting || phase == .live
      if phase == .ended, saving == nil {
        Task { await save() }
      }
    }
  }

  private func makeCall() {
    guard call == nil else {
      return
    }

    let created = LiveCall(
      conversation: conversation,
      client: .live(conversationId: conversation.id, voice: voice, api: voice.liveCalls))
    call = created

    if callsRightAway {
      Task { await created.start() }
    }
  }

  /// A fresh run: "Try again" calls right away, a takeover ends the other call first.
  private func restart(takeover: Bool = false, callNow: Bool = true) {
    call?.leave()
    saving = nil
    usedHelp = false
    callsRightAway = callNow && !takeover
    call = nil
    makeCall()

    if takeover, let call {
      Task { await call.start(takeover: true) }
    }
  }

  @ViewBuilder
  private func runView(_ call: LiveCall) -> some View {
    if conversation.locked || call.failure == .plusRequired {
      ConversationIntro(conversation: conversation, isLocked: true) {}
    } else if call.phase == .idle {
      ConversationIntro(conversation: conversation, isLocked: false) {
        Task { await call.start() }
      }
    } else if saving == .ended || saving == .takenOver {
      CallProblemView(problem: .saveEnded(takenOver: saving == .takenOver)) { action in
        handle(action, call: call)
      }
    } else if let saving {
      SavingCallView(
        state: saving,
        isGrading: conversation.kind == .speakingMock || conversation.speakingTask != nil
      ) {
        Task { await save() }
      }
    } else if call.phase == .ended {
      SavingCallView(state: .saving, isGrading: conversation.speakingTask != nil) {}
    } else if call.phase == .failed, let failure = call.failure {
      CallProblemView(problem: .call(failure, call.limit)) { action in
        handle(action, call: call)
      }
    } else {
      ConversationLiveView(
        call: call, conversation: conversation, usedHelp: $usedHelp,
        onEnd: {
          // A call that hasn't connected yet has nothing to save: ending it goes back to the intro.
          if call.phase == .connecting {
            restart(callNow: false)
          } else {
            call.hangUp()
          }
        })
    }
  }

  private func handle(_ action: CallProblemView.Action, call: LiveCall) {
    switch action {
    case .retry:
      restart()
    case .takeover:
      restart(takeover: true)
    case .end:
      Task { await save() }
    case .back:
      dismiss()
    }
  }

  /// Nothing is saved, reviewed or rewarded until the server confirmed the call closed.
  private func save() async {
    guard let call else {
      return
    }

    saving = .saving

    guard var input = await call.finish() else {
      saving = .closing
      return
    }

    input.usedHelp = usedHelp
    let completionInput = input
    let api = voice.liveCalls
    let conversationId = conversation.id
    let completion = await voice.cache.mutate { identity in
      try await api.complete(
        conversationId: conversationId, input: completionInput, token: identity.bearerToken)
    }

    switch completion {
    case .done(.completed(let completed)):
      // Brain Power, missions, today's time, the unit's or exam's standing, and call time.
      voice.cache.invalidate([.userProgress, .goals, .learnerModel, .allowance])
      await onSaved(DayResult(completed))
    case .done(.ended):
      saving = .ended
    case .done(.takenOver):
      saving = .takenOver
    case .done(.failed), .failed:
      saving = .failed
    case .obsolete:
      break
    }
  }
}
