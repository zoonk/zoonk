import SwiftUI

/// A checkpoint's call before it's made, read without writing anything. Call makes the call.
struct CheckpointCallIntro: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(AppRouter.self) private var router
  @State private var isStarting = false
  @State private var isWriting = false
  @State private var didFail = false
  @State private var needsPlus = false
  @State private var starting: Task<Void, Never>?

  let call: Resource<LanguageCheckpointCall>
  let blockId: String
  /// `callsNow`: the learner tapped Call on the intro, rather than having the call written first.
  let onStarted: (_ conversationId: String, _ callsNow: Bool) -> Void

  var body: some View {
    content
      .loads(call)
      .navigationTitle(
        Text("Unit challenge", tableName: "Voice", comment: "A checkpoint call's title")
      )
      .onDisappear { starting?.cancel() }
      .onChange(of: call.value, initial: true) { _, value in
        if case .earlierFirst? = value {
          router.showRoot(of: .today)
        }
      }
  }

  @ViewBuilder
  private var content: some View {
    switch call.state {
    case .loaded(.notStarted(let preview)):
      ConversationIntro(intro: CallIntro(preview.intro)) {
        if needsPlus {
          CallStartFooter(isLocked: true, callee: nil) {}
        } else if preview.dailyLimitReached {
          StudyTimeUsedUp()
        } else {
          startButton(writesFirst: false, callee: preview.intro.character.name)
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
        if needsPlus {
          CallStartFooter(isLocked: true, callee: nil) {}
        } else if isWriting {
          WritingWait(
            title: Text(
              "Getting your call ready", tableName: "Voice",
              comment: "A checkpoint's call is being written"),
            hint: Text(
              "It opens here as soon as it's ready.", tableName: "Voice",
              comment: "A checkpoint's call opens by itself once it's written"))
        } else {
          startButton(writesFirst: true, callee: nil)
        }
      }
    case .loaded(.plusRequired):
      VStack(spacing: 12) {
        CallStartFooter(isLocked: true, callee: nil) {}
      }
      .scenePadding()
      .frame(maxHeight: .infinity)
    case .empty, .failed(.notFound), .loaded(.notLanguage):
      CallNotHere()
    case .failed(let error) where error != .unauthorized:
      CallLoadFailed {
        Task { await call.refresh() }
      }
    default:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  /// Writing the call first calls no one, so only the button that calls has the phone.
  private func startButton(writesFirst: Bool, callee: String?) -> some View {
    VStack(spacing: 8) {
      if didFail {
        Text(
          "The call didn't start. Try again in a moment.", tableName: "Voice",
          comment: "Starting a checkpoint call failed"
        )
        .font(.subheadline)
        .foregroundStyle(.destructiveText)
      }

      Button {
        starting = Task { await start(writesFirst: writesFirst) }
      } label: {
        if isStarting {
          Label {
            Text("Starting…", tableName: "Voice", comment: "A call is starting")
          } icon: {
            ProgressView()
          }
          .frame(maxWidth: .infinity)
        } else if writesFirst {
          Text(
            "Get the call ready", tableName: "Voice",
            comment: "Writes a checkpoint's call, then opens it"
          )
          .frame(maxWidth: .infinity)
        } else {
          Label {
            CallButtonTitle(callee: callee)
          } icon: {
            Image(systemName: "phone.fill")
          }
          .frame(maxWidth: .infinity)
        }
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .keyboardShortcut(.defaultAction)
      .disabled(isStarting)
    }
  }

  /// Mirrors main's `startCheckpointCallAction`: what changed since the intro was read (the daily
  /// time limit, earlier work, the block finished elsewhere, the block gone, a call no longer
  /// written) shows as the intro is read again; only a failure is worth another try.
  private func start(writesFirst: Bool) async {
    isStarting = true
    didFail = false
    defer {
      isStarting = false
      isWriting = false
    }

    guard let started = await started(writesFirst: writesFirst) else {
      await call.refresh()
      return
    }

    switch started {
    case .done(.done(let conversationId)):
      onStarted(conversationId, !writesFirst)
    case .done(.refused(let refusal)) where refusal.isPlusRequired:
      needsPlus = true
    case .done(.refused(let refusal)) where Self.changes.contains(refusal.code):
      await call.refresh()
    case .failed(.notFound):
      await call.refresh()
    case .done(.refused), .failed:
      didFail = true
    case .obsolete:
      break
    }
  }

  /// Nil when the intro's call isn't written any more.
  private func started(writesFirst: Bool) async -> MutationResult<Refusable<String>>? {
    let input = Components.Schemas.LanguageConversationStartInput.case2(
      .init(blockId: blockId, kind: .checkpoint))

    if writesFirst {
      return await voice.startConversation(input) { isWriting = true }
    }

    switch await voice.startWrittenConversation(input) {
    case .done(.done(let answer)): return .done(answer)
    case .done(.writing): return nil
    case .failed(let error): return .failed(error)
    case .obsolete: return .obsolete
    }
  }

  private static let changes: Set<String> = [
    "BLOCK_FINISHED", "DAILY_LIMIT_REACHED", "EARLIER_FIRST",
  ]
}

/// Start would refuse the call until the learner's next session.
private struct StudyTimeUsedUp: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    Text(
      "You've reached your daily time limit. You can make this call in your next session.",
      tableName: "Voice", comment: "The daily time limit is a setting that stops study for the day."
    )
    .font(.footnote)
    .foregroundStyle(.mutedForeground)
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
