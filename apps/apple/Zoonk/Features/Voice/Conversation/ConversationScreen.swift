import SwiftUI

/// A call that already ended opens on its result. A checkpoint's call opens on its intro before
/// it's made, and its Call makes the call and calls at once, as main's checkpoint page does.
struct ConversationScreen: View {
  enum Source: Equatable {
    case conversation(String)
    case checkpoint(blockId: String)
  }

  @Environment(VoiceServices.self) private var voice
  @Environment(\.dismiss) private var dismiss
  /// A call in progress can't be swiped away: End hangs it up and saves it.
  @State private var isInCall = false
  @State private var day: DayResult?
  @State private var started: String?
  /// The learner tapped Call on the intro: a call written first opens on its intro instead.
  @State private var callsNow = false

  let source: Source
  /// A running mock's speaking task goes back to the mock without the call's own result: the mock's
  /// result reads it.
  var onSaved: (() -> Void)? = nil

  init(conversationId: String, onSaved: (() -> Void)? = nil) {
    source = .conversation(conversationId)
    self.onSaved = onSaved
  }

  init(checkpointBlockId: String) {
    source = .checkpoint(blockId: checkpointBlockId)
  }

  var body: some View {
    NavigationStack {
      Group {
        switch source {
        case .conversation(let conversationId):
          conversation(started ?? conversationId, callsRightAway: false)
        case .checkpoint(let blockId):
          checkpoint(blockId)
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
  }

  @ViewBuilder
  private func checkpoint(_ blockId: String) -> some View {
    let call = voice.checkpointCall(blockId: blockId)

    if let started {
      conversation(started, callsRightAway: callsNow)
    } else if case .ready(let made)? = call.value {
      conversation(made.conversationId, callsRightAway: false)
    } else {
      CheckpointCallIntro(call: call, blockId: blockId) { conversationId, callsNow in
        self.callsNow = callsNow
        started = conversationId
      }
    }
  }

  private func conversation(_ conversationId: String, callsRightAway: Bool) -> some View {
    ConversationLoad(
      conversationId: conversationId, callsRightAway: callsRightAway, isInCall: $isInCall,
      day: $day, onSaved: onSaved
    ) { again in
      day = nil
      callsNow = false
      started = again
    }
    .id(conversationId)
  }
}

private struct ConversationLoad: View {
  @Environment(VoiceServices.self) private var voice

  let conversationId: String
  let callsRightAway: Bool
  @Binding var isInCall: Bool
  @Binding var day: DayResult?
  let onSaved: (() -> Void)?
  let onStartedAgain: (String) -> Void

  var body: some View {
    let conversation = voice.conversation(id: conversationId)

    content(conversation)
      .loads(conversation, refreshable: false)
  }

  @ViewBuilder
  private func content(_ resource: Resource<LanguageConversation>) -> some View {
    switch resource.state {
    case .idle, .loading:
      ProgressView()
        .navigationTitle(untitledCall)
    case .empty, .failed(.notFound):
      NotFoundView()
        .navigationTitle(untitledCall)
    case .failed:
      CallLoadFailed {
        Task { await resource.refresh() }
      }
      .navigationTitle(untitledCall)
    case .loaded(let value):
      if value.result != nil {
        ConversationResultView(conversation: value, day: day, onStartedAgain: onStartedAgain)
          .navigationTitle(ConversationTitle(conversation: value).text)
      } else {
        LiveCallRun(
          conversation: value, isInCall: $isInCall, callsRightAway: callsRightAway
        ) { saved in
          if let onSaved {
            // The mock's result reopens this call for its feedback.
            resource.invalidate()
            onSaved()
            return
          }

          day = saved
          await resource.refresh()
        }
        .navigationTitle(ConversationTitle(conversation: value).text)
      }
    }
  }

  private var untitledCall: Text {
    Text("Conversation", tableName: "Voice", comment: "Names a call's screen until the call loads")
  }
}

struct CallLoadFailed: View {
  let retry: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text("The call didn't load", tableName: "Voice", comment: "Loading a conversation failed")
      } icon: {
        Image(systemName: "wifi.exclamationmark")
      }
    } actions: {
      Button(action: retry) {
        Text("Try again", tableName: "Voice", comment: "Button to retry loading")
      }
      .buttonStyle(.bordered)
    }
  }
}

enum LiveCallSaveState: Equatable {
  case saving
  case closing
  case failed
  case ended
  case takenOver
}

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

private struct LiveCallRun: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(\.dismiss) private var dismiss
  @Environment(\.scenePhase) private var scenePhase
  @State private var call: LiveCall?
  @State private var saving: LiveCallSaveState?
  @State private var restarting: Task<Void, Never>?
  let conversation: LanguageConversation
  @Binding var isInCall: Bool
  @State var callsRightAway: Bool
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
      restarting?.cancel()
      call?.leave()
      isInCall = false
    }
    .onChange(of: call?.phase) { _, phase in
      isInCall = phase == .connecting || phase == .live
      if phase == .ended, saving == nil {
        Task { await save() }
      }
    }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active, let call {
        Task { await call.recheckMicrophone() }
      }
    }
  }

  private func makeCall(soFar: CallSoFar? = nil) {
    guard call == nil else {
      return
    }

    let created = LiveCall(
      conversation: conversation,
      client: .live(conversationId: conversation.id, voice: voice, api: voice.liveCalls),
      soFar: soFar)
    call = created

    if callsRightAway {
      Task { await created.start() }
    }
  }

  /// The call so far goes on, as calling someone back does; the server says when it's a new call. A
  /// dropped call's reconnect may still be reserving: the next run must name its connection.
  private func restart(takeover: Bool = false, callNow: Bool = true) {
    guard let previous = call else {
      return
    }

    func replace() {
      let soFar = previous.soFar
      previous.leave()
      saving = nil
      callsRightAway = callNow && !takeover
      call = nil
      makeCall(soFar: soFar)

      if takeover, let call {
        Task { await call.start(takeover: true) }
      }
    }

    guard previous.continuing else {
      replace()
      return
    }

    restarting?.cancel()
    restarting = Task {
      await previous.settled()

      // Ended while it waited: the save has the call.
      if !Task.isCancelled, saving == nil {
        replace()
      }
    }
  }

  /// Once the call is being saved, the transcript stays with the save's status.
  @ViewBuilder
  private func runView(_ call: LiveCall) -> some View {
    if saving == .ended || saving == .takenOver {
      CallProblemView(problem: .saveEnded(takenOver: saving == .takenOver)) { action in
        handle(action, call: call)
      }
    } else if saving != nil {
      liveView(call)
    } else if let dropped = call.dropped {
      DroppedCallView(dropped: dropped, limit: call.limit, name: conversation.character.name) {
        action in
        handle(action, call: call)
      }
    } else if conversation.locked || call.failure == .plusRequired {
      ConversationIntro(intro: CallIntro(conversation)) {
        CallStartFooter(isLocked: true, callee: nil) {}
      }
    } else if call.phase == .idle, !call.continuing {
      ConversationIntro(intro: CallIntro(conversation)) {
        if call.micBlocked {
          CallMicrophoneOff(name: conversation.character.name) {
            Task { await call.startTyping() }
          }
        } else {
          CallStartFooter(isLocked: false, callee: callee) {
            Task { await call.start() }
          }
        }
      }
    } else if call.phase == .failed, let failure = call.failure {
      CallProblemView(problem: .call(failure, call.limit)) { action in
        handle(action, call: call)
      }
    } else {
      liveView(call)
    }
  }

  private func liveView(_ call: LiveCall) -> some View {
    ConversationLiveView(
      call: call, conversation: conversation, saving: saving,
      onEnd: {
        if call.phase == .connecting {
          call.cancel()

          // A dropped call stays dropped, to end or call again; a new one, with nothing to save,
          // goes back to its intro.
          if !call.continuing {
            restart(callNow: false)
          }
        } else {
          call.hangUp()
        }
      },
      onRetrySave: {
        Task { await save() }
      })
  }

  private var callee: String? {
    conversation.callsCharacter ? conversation.character.name : nil
  }

  private func handle(_ action: CallProblemAction, call: LiveCall) {
    switch action {
    case .retry:
      restart()
    case .takeover:
      restart(takeover: true)
    case .type:
      Task { await call.startTyping() }
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

    guard let completionInput = await call.finish() else {
      saving = .closing
      return
    }

    let api = voice.liveCalls
    let conversationId = conversation.id
    let completion = await voice.cache.mutate { identity in
      try await api.complete(
        conversationId: conversationId, input: completionInput, token: identity.bearerToken)
    }

    switch completion {
    case .done(.completed(let completed)):
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
