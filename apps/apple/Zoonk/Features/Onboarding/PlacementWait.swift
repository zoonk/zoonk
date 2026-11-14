import SwiftUI

/// Placement's wait while its questions are written, for placement and the Focus test: the goal's
/// run and its warm-up deck in onboarding, the deck alone on a plan that's already there.
struct PlacementWaitScreen: View {
  /// The goal being set up; nil on a plan that's already there.
  let onboarding: GoalOnboarding?
  let goalID: String
  let run: GenerationWait
  let failure: GenerationFailure?
  let holding: WaitHolding?
  /// Another of the screen's saves is running.
  let isActing: Bool
  let skip: Skip
  let onRetry: (GenerationFailure) -> Void

  /// The way out of the wait, under its quiz.
  struct Skip {
    let label: Text
    let note: Text?
    let isBusy: Bool
    let failed: Bool
    let action: () -> Void
  }

  @Environment(OnboardingStore.self) private var store

  static let questionsReady = LocalizedStringResource(
    "Your test is ready", table: "Onboarding",
    comment: "Title of placement's wait once its questions are ready, for a learner still guessing")

  private var readsMaterial: Bool {
    run.phases.contains { $0.id == "notice" && $0.isReported }
  }

  var body: some View {
    let failure = holding == nil ? failure : nil
    let shown = holding == nil ? run : run.finished
    let title =
      holding == nil
      ? Text(
        "Getting your test ready", tableName: "Onboarding",
        comment: "Title while placement questions are written")
      : Text(Self.questionsReady)

    WaitScreen(
      deck: onboarding.map(store.waitDeck(for:)) ?? WaitDeck(id: nil, isComing: false),
      goalID: goalID,
      progressTitle: title,
      ready: holding.map { holding in
        WaitReady(
          label: Text(
            "Continue", tableName: "Onboarding",
            comment: "Leaves placement's wait, once its questions are ready, for the questions"),
          action: holding.moveOn)
      }
    ) {
      if let failure {
        GenerationFailureNotice(failure: failure, isActing: isActing || skip.isBusy) {
          onRetry(failure)
        }
      } else {
        WaitStatusStrip(label: title, isDone: holding != nil, share: { shown.shownShare(at: $0) })
      }
    } progress: {
      WaitHeading(
        title: title,
        description: holding != nil
          ? nil
          : readsMaterial
            ? Text(
              "Reading your material takes a few minutes.", tableName: "Onboarding",
              comment: "How long placement questions take to write from the learner's material")
            : Text(
              "This takes a minute or two.", tableName: "Onboarding",
              comment: "How long placement questions take to write. \"This\" is the wait."))

      Section {
        GenerationTimeline(wait: shown, failure: failure)
      }
      .listRowBackground(Color.clear)
      .listRowSeparator(.hidden)
    } extra: {
      VStack(spacing: 6) {
        if skip.failed, !skip.isBusy {
          FailureLine(
            message: LocalizedStringResource(
              "That didn't save. Try again.", table: "Onboarding",
              comment: "A change couldn't be saved")
          )
          .multilineTextAlignment(.center)
        }

        BusyButton(isBusy: skip.isBusy, icon: .skip, action: skip.action) {
          skip.label
        }
        .buttonStyle(.outline)
        .buttonSizing(.flexible)
        .disabled(isActing)

        if let note = skip.note {
          note
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
            .multilineTextAlignment(.center)
        }
      }
    }
    .measuresWait(
      surface: "placementWait", contentKind: "curriculum", goalID: goalID,
      onboardingID: onboarding?.onboardingID)
  }

  /// Reads until the questions come: each event of the goal's run says when to read again, then a
  /// few more reads, more slowly each time. `isWaiting` reads and says whether they still aren't
  /// there. False when it gave up, so the wait offers its retry.
  static func follow(
    generationID: String?, store: OnboardingStore, apply: (GenerationEvent) -> Void,
    isWaiting: () async -> Bool
  ) async -> Bool {
    guard await isWaiting() else {
      return true
    }

    if let generationID {
      do {
        for try await event in store.events(generationID: generationID) {
          if let id = event.warmUpID {
            store.found(deckID: id, generationID: generationID)
          }

          apply(event)

          guard await isWaiting() else {
            return true
          }
        }
      } catch {
        // A dropped stream falls back to reading again below.
      }
    }

    // The questions come from a run of their own once the skills are saved.
    for delay in [3, 5, 8, 13, 21, 34] {
      try? await Task.sleep(for: .seconds(delay))

      guard !Task.isCancelled, await isWaiting() else {
        return true
      }
    }

    return Task.isCancelled
  }
}
