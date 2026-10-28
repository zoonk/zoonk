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

struct CheckpointCallView: View {
  let blockId: String

  var body: some View {
    ContentUnavailableView {
      Label {
        Text("The unit's call", tableName: "Voice", comment: "A language checkpoint's call")
      } icon: {
        Image(systemName: "phone")
      }
    } description: {
      Text(
        "A live call where you get your point across. Speak or type.", tableName: "Voice",
        comment: "What a language checkpoint's call is")
    } actions: {
      ChallengeCallView(blockId: blockId)
    }
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
