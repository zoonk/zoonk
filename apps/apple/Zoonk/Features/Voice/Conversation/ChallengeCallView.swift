import SwiftUI

/// A language goal's phase or final challenge is the unit's live call: Start begins the challenge's
/// block, creates its checkpoint call and opens it. The challenge screen (practice lane) shows this
/// in place of its Start through `PracticeHooks.challengeCall`. Only on the learner's tap.
struct ChallengeCallView: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(PracticeStore.self) private var practice
  @State private var isStarting = false
  @State private var didFail = false
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss

  let planItemId: String

  var body: some View {
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

    let api = practice.api
    let started = await voice.cache.mutate { identity in
      try await api.startChallenge(
        token: identity.bearerToken, planItemId: planItemId, afterWriting: false)
    }

    guard case .done(let start) = started else {
      didFail = started.isFailure
      return
    }

    practice.changed(.answered)

    switch await voice.startConversation(.case2(.init(blockId: start.blockId, kind: .checkpoint))) {
    case .done(.done(let id)):
      // The call takes the challenge's place, as starting a duel opens its checkpoint.
      dismiss()
      router.open(.conversation(conversationId: id))
    case .done(.refused), .failed:
      didFail = true
    case .obsolete:
      break
    }
  }
}

extension MutationResult {
  /// The write failed for the learner still here; an obsolete one says nothing.
  fileprivate var isFailure: Bool {
    if case .failed = self {
      return true
    }

    return false
  }
}
