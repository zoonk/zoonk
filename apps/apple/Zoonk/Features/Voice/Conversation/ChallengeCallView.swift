import SwiftUI

/// Start creates the checkpoint call only on the learner's tap.
struct ChallengeCallView: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(PracticeStore.self) private var practice
  @State private var isStarting = false
  @State private var didFail = false
  @State private var needsPlus = false
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss

  private let challenge: Challenge

  private enum Challenge {
    case planItem(String)
    case block(String)
  }

  init(planItemId: String) {
    challenge = .planItem(planItemId)
  }

  init(blockId: String) {
    challenge = .block(blockId)
  }

  var body: some View {
    if needsPlus {
      PlusNotice(
        description: Text(
          "Challenge calls come with Plus. Your plan keeps going without them.",
          tableName: "Voice", comment: "A checkpoint call or exam speaking task needs Plus"))
    } else {
      startButton
    }
  }

  private var startButton: some View {
    VStack(spacing: 8) {
      if didFail {
        Text(
          "The call didn't start. Try again in a moment.", tableName: "Voice",
          comment: "Starting a checkpoint call failed"
        )
        .font(.subheadline)
        .foregroundStyle(.destructive)
      }

      Button {
        Task { await start() }
      } label: {
        Label {
          if isStarting {
            Text("Starting…", tableName: "Voice", comment: "A call is starting")
          } else {
            Text("Start the call", tableName: "Voice", comment: "Starts a live call")
          }
        } icon: {
          if isStarting {
            ProgressView()
          } else {
            Image(systemName: "phone.fill")
          }
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .disabled(isStarting)
    }
  }

  private func start() async {
    isStarting = true
    didFail = false
    defer { isStarting = false }

    guard let blockId = await block() else {
      return
    }

    switch await voice.startConversation(.case2(.init(blockId: blockId, kind: .checkpoint))) {
    case .done(.done(let id)):
      // The call takes the challenge's place, as starting a duel opens its checkpoint.
      dismiss()
      router.open(.conversation(conversationId: id))
    case .done(.refused(let refusal)) where refusal.isPlusRequired:
      needsPlus = true
    case .done(.refused), .failed:
      didFail = true
    case .obsolete:
      break
    }
  }
}

extension ChallengeCallView {
  fileprivate func block() async -> String? {
    switch challenge {
    case .block(let blockId):
      return blockId
    case .planItem(let planItemId):
      let api = practice.api
      let started = await voice.cache.mutate { identity in
        try await api.startChallenge(
          token: identity.bearerToken, planItemId: planItemId, afterWriting: false)
      }

      guard case .done(let start) = started else {
        didFail = started.isFailure
        return nil
      }

      practice.changed(.answered)
      return start.blockId
    }
  }
}

/// Mirrors main's checkpoint page: a language goal's call shows its intro before Start makes it.
struct CheckpointCallView: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss

  let blockId: String

  var body: some View {
    let call = voice.checkpointCall(blockId: blockId)

    content(call)
      .loads(call)
      .onChange(of: call.value, initial: true) { _, value in
        switch value {
        case .ready(let made)?:
          dismiss()
          router.open(.conversation(conversationId: made.conversationId))
        case .earlierFirst?:
          router.showRoot(of: .today)
        default:
          break
        }
      }
  }

  @ViewBuilder
  private func content(_ call: Resource<LanguageCheckpointCall>) -> some View {
    switch call.state {
    case .loaded(.notStarted(let preview)):
      ConversationIntro(intro: CallIntro(preview.intro)) {
        if preview.dailyLimitReached {
          StudyTimeUsedUp()
        } else {
          ChallengeCallView(blockId: blockId)
        }
      }
    case .loaded(.preparing(let preparing)):
      ContentUnavailableView {
        Label(preparing.unitTitle, systemImage: "phone")
      } description: {
        Text(
          "This challenge is a short call about the unit. It's written for your speaking level first, which takes up to half a minute.",
          tableName: "Voice", comment: "A language checkpoint's call that isn't written yet")
      } actions: {
        ChallengeCallView(blockId: blockId)
      }
    case .loaded(.plusRequired):
      PlusNotice(
        description: Text(
          "Challenge calls come with Plus. Your plan keeps going without them.",
          tableName: "Voice", comment: "A checkpoint call or exam speaking task needs Plus")
      )
      .scenePadding()
    case .empty, .failed(.notFound), .loaded(.notLanguage):
      ContentUnavailableView {
        Label {
          Text(
            "This call isn't here", tableName: "Voice", comment: "A conversation that doesn't exist"
          )
        } icon: {
          Image(systemName: "phone.badge.waveform")
        }
      }
    case .failed(let error) where error != .unauthorized:
      ContentUnavailableView {
        Label {
          Text("The call didn't load", tableName: "Voice", comment: "Loading a conversation failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await call.refresh() }
        } label: {
          Text("Try again", tableName: "Voice", comment: "Button to retry loading")
        }
        .buttonStyle(.bordered)
      }
    default:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }
}

/// Start would refuse the call until the learner's next session.
private struct StudyTimeUsedUp: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    Text(
      "You've reached today's study time. It'll be in your next session.", tableName: "Voice",
      comment: "A checkpoint call that today's study time no longer has room for"
    )
    .font(.footnote)
    .foregroundStyle(.secondary)
    .frame(maxWidth: .infinity, alignment: .leading)

    Button {
      router.showRoot(of: .today)
    } label: {
      Text("Back to Today", tableName: "Voice", comment: "Leaves a call for Today")
        .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
  }
}

extension MutationResult {
  fileprivate var isFailure: Bool {
    if case .failed = self {
      return true
    }

    return false
  }
}
