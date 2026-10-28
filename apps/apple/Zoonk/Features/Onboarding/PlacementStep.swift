import SwiftUI

/// Placement while the first lessons are made (main's `PlacementStep`): adaptive questions from the goal's skill map, with "I don't know yet" welcome and no score. It ends when every area has a starting point, when nothing more can be asked today, or whenever the learner stops; "Skip and start from the basics" skips it. While the skill map or the next questions are being written, it waits for them.
struct PlacementStep: View {
  let view: GoalOnboarding
  let subject: String
  let onDone: () -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var phase = Phase.loading
  @State private var draft: PracticeAnswer?
  @State private var shownAt = ContinuousClock.now
  @State private var isSaving = false
  @State private var failed = false
  /// Neither a question's number nor the bar ever goes back while the plan is still being written.
  @State private var shown = (answered: 0, spent: 0.0)

  private enum Phase {
    case loading
    case intro
    case waiting
    case question(PracticeQuestion, labels: PracticeTrueFalseLabels)
    case done(forToday: Bool)
    case unavailable
  }

  var body: some View {
    Group {
      switch phase {
      case .loading:
        ProgressView()
      case .intro:
        intro
      case .waiting:
        waiting
      case .question(let question, let labels):
        questionScreen(question, labels: labels)
      case .done(let forToday):
        outcome(
          title: forToday
            ? Text(
              "That's enough questions for today", tableName: "Onboarding",
              comment: "Placement ended for the day")
            : Text(
              "Your starting point is set", tableName: "Onboarding", comment: "Placement ended"),
          description: forToday
            ? Text(
              "Your first sessions ask a few more to fine-tune your plan.", tableName: "Onboarding",
              comment: "Under placement ended for the day")
            : Text(
              "It gets more accurate every day.", tableName: "Onboarding",
              comment: "Under placement ended"))
      case .unavailable:
        outcome(
          title: Text(
            "Let's skip the questions", tableName: "Onboarding",
            comment: "No placement question could be written"),
          description: Text(
            "We couldn't prepare questions for this goal. Your first sessions will find your starting point instead.",
            tableName: "Onboarding", comment: "Why placement is skipped"))
      }
    }
    .task { await resume() }
  }

  private var intro: some View {
    Form {
      StepHeader(
        subject: subject,
        title: Text(
          "Let's see what you already know", tableName: "Onboarding",
          comment: "Title of placement's start"),
        description: view.examSubjects.isEmpty
          ? Text(
            "A few quick questions, so your plan skips what you already know. There's no score, and “I don't know yet” is a fine answer.",
            tableName: "Onboarding", comment: "What placement is")
          : Text(
            "A few quick questions about the \(view.examSubjects.count) areas, so your plan skips what you already know. There's no score, and “I don't know yet” is a fine answer.",
            tableName: "Onboarding", comment: "What placement is for an exam with several areas"))

      StepButtons(
        continueLabel: Text(
          "Start", tableName: "Onboarding", comment: "Starts placement's questions"),
        skipLabel: Text(
          "Skip and start from the basics", tableName: "Onboarding",
          comment: "Skips placement; the plan starts at the beginning")
      ) {
        phase = .waiting
      } onSkip: {
        finish(fromScratch: true)
      }

      if view.goal.kind == .exam {
        PlacementMockOffer(goalId: view.goal.id)
      }
    }
    .disabled(isSaving)
    .modifier(PlacementMockLoading(goalId: view.goal.id, isExam: view.goal.kind == .exam))
  }

  /// The questions come from the goal's skill map, which may still be drawn right after the goal: the wait follows the goal's run, then reads again until they come.
  private var waiting: some View {
    Form {
      StepHeader(
        title: Text(
          "Getting your questions ready", tableName: "Onboarding",
          comment: "Title while placement questions are written"),
        description: Text(
          "They come from the skills your goal needs. It usually takes a minute or two.",
          tableName: "Onboarding",
          comment: "Why placement questions take a moment"))

      Section {
        ProgressView()
          .frame(maxWidth: .infinity)
      }

      Section {
        Button {
          finish(fromScratch: false)
        } label: {
          Text(
            "Skip for now", tableName: "Onboarding",
            comment: "Skips placement while its questions are written"
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
      } footer: {
        Text(
          "Your first sessions will ask a few of these instead.", tableName: "Onboarding",
          comment: "Under Skip for now")
      }
    }
    .disabled(isSaving)
    .task { await waitForQuestions() }
  }

  private func questionScreen(_ question: PracticeQuestion, labels: PracticeTrueFalseLabels)
    -> some View
  {
    PracticeTaskLayout {
      VStack(alignment: .leading, spacing: 4) {
        Text(subject)
          .font(.subheadline)
          .foregroundStyle(.secondary)
        Text(
          "Question \(shown.answered + 1)", tableName: "Onboarding",
          comment: "Which placement question this is"
        )
        .font(.subheadline.weight(.semibold))
      }

      ProgressView(value: shown.spent)
        .tint(.success)
        .accessibilityHidden(true)

      PracticeQuestionView(question: question, labels: labels, draft: $draft) { answer in
        submit(answer, to: question)
      }

      if failed {
        Text(
          "That didn't save. Try again.", tableName: "Onboarding",
          comment: "A change couldn't be saved"
        )
        .foregroundStyle(.destructive)
      }
    } actions: {
      PracticeMainButton(
        title: LocalizedStringResource(
          "Confirm", table: "Onboarding", comment: "Sends a placement answer"),
        isBusy: isSaving, isDisabled: draft == nil || isSaving
      ) {
        if let draft {
          submit(draft, to: question)
        }
      }

      PracticeSecondaryButton(
        title: LocalizedStringResource(
          "I don't know yet", table: "Onboarding",
          comment: "Answers a placement question without guessing"),
        systemImage: "questionmark.circle", isDisabled: isSaving
      ) {
        submit(.dontKnow, to: question)
      }

      Button {
        finish(fromScratch: false)
      } label: {
        Text("Stop here and see my plan", tableName: "Onboarding", comment: "Ends placement early")
      }
      .disabled(isSaving)
    }
  }

  private func outcome(title: Text, description: Text) -> some View {
    Form {
      StepHeader(title: title, description: description)

      StepButtons(
        continueLabel: Text(
          "See my plan", tableName: "Onboarding", comment: "Ends placement and shows the plan")
      ) {
        finish(fromScratch: false)
      }
    }
    .disabled(isSaving)
  }

  /// Coming back returns to where placement was: its next question once it has answers, else its start.
  private func resume() async {
    guard case .loading = phase else {
      return
    }

    guard let placement = try? await onboarding.placement(goalID: view.goal.id) else {
      phase = .intro
      return
    }

    if placement.started {
      show(placement)
    } else {
      phase = .intro
    }
  }

  private func read() async {
    guard let placement = try? await onboarding.placement(goalID: view.goal.id) else {
      return
    }

    show(placement)
  }

  private func waitForQuestions() async {
    await read()

    guard case .waiting = phase else {
      return
    }

    if let generationID = view.generationId {
      // Each step of the goal's run may have written what placement asks.
      do {
        for try await _ in onboarding.events(generationID: generationID) {
          await read()

          guard case .waiting = phase else {
            return
          }
        }
      } catch {
        // A dropped stream falls back to reading again below.
      }
    }

    // The questions come from a run of their own once the skills are saved: read again a few times, more slowly each time.
    for delay in [3, 5, 8, 13, 21, 34] {
      try? await Task.sleep(for: .seconds(delay))

      guard !Task.isCancelled, case .waiting = phase else {
        return
      }

      await read()
    }
  }

  private func show(_ placement: GoalPlacement) {
    shown = (max(shown.answered, placement.answered), max(shown.spent, placement.dayBudgetSpent))

    switch placement.status {
    case .asking:
      guard let next = placement.next,
        let question = try? PracticeJSON.recode(next, as: PracticeQuestion.self)
      else {
        phase = .unavailable
        return
      }

      draft = nil
      shownAt = .now
      phase = .question(
        question, labels: placement.trueFalseLabels == .rightWrong ? .rightWrong : .trueFalse)
    case .done:
      phase = .done(forToday: placement.dayBudgetUsed)
    case .unavailable, .failed:
      phase = .unavailable
    case .preparing, .waitingForQuestions:
      phase = .waiting
    }
  }

  private func submit(_ answer: PracticeAnswer, to question: PracticeQuestion) {
    guard !isSaving else {
      return
    }

    isSaving = true
    failed = false

    Task {
      defer { isSaving = false }

      do {
        let result = try await onboarding.answerPlacement(
          goalID: view.goal.id, itemID: question.itemId, answer: answer,
          duration: shownAt.duration(to: .now))
        shown.answered += 1
        show(result.placement)
      } catch {
        failed = true
      }
    }
  }

  private func finish(fromScratch: Bool) {
    guard !isSaving else {
      return
    }

    isSaving = true
    failed = false

    Task {
      defer { isSaving = false }

      do {
        try await onboarding.finishPlacement(goalID: view.goal.id, fromScratch: fromScratch)
        onDone()
      } catch {
        failed = true
      }
    }
  }
}

/// A language goal's placement is its level test (main's `LanguageLevelTestStep`). The app doesn't run the test's reading, listening and spoken questions yet, so it offers main's other way on: skipping it, which keeps the level the learner gave.
struct LevelTestStep: View {
  let goalID: String
  let targetLanguage: String
  let onDone: () -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var isSkipping = false
  @State private var failed = false

  var body: some View {
    Form {
      StepHeader(
        title: Text(
          "Let's see your level in \(Locale.current.localizedString(forLanguageCode: targetLanguage) ?? targetLanguage)",
          tableName: "Onboarding", comment: "Title of a language goal's level test"),
        description: Text(
          "Your plan starts from the level you gave, and your first sessions fine-tune it.",
          tableName: "Onboarding", comment: "What skipping the level test does"))

      if failed {
        Section {
          Text(
            "That didn't save. Try again.", tableName: "Onboarding",
            comment: "A change couldn't be saved"
          )
          .foregroundStyle(.destructive)
        }
      }

      StepButtons(
        canContinue: !isSkipping,
        continueLabel: Text(
          "Skip the test", tableName: "Onboarding", comment: "Skips a language goal's level test")
      ) {
        Task { await skip() }
      }
    }
  }

  private func skip() async {
    isSkipping = true
    failed = false
    defer { isSkipping = false }

    do {
      try await onboarding.skipLevelTest(goalID: goalID)
      onDone()
    } catch {
      failed = true
    }
  }
}
