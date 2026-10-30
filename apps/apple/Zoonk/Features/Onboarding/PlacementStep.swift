import SwiftUI

/// "I don't know yet" is welcome and there's no score. It ends when every area has a starting point,
/// when nothing more can be asked today, or whenever the learner stops.
struct PlacementStep: View {
  let view: GoalOnboarding
  let subject: String
  let onDone: () -> Void

  @Environment(AppRouter.self) private var router
  @Environment(ExamStore.self) private var exam
  @Environment(OnboardingStore.self) private var onboarding
  @State private var phase = Phase.loading
  @State private var shownAt = ContinuousClock.now
  @State private var isSaving = false
  @State private var failed = false
  @State private var isWaitLost = false
  @State private var waitRound = 0
  /// Neither a question's number nor the bar ever goes back while the plan is still being written.
  @State private var shown = (answered: 0, spent: 0.0)

  private enum Phase {
    case loading
    case intro
    case waiting
    case question(PracticeQuestion, labels: PracticeTrueFalseLabels)
    case done(forToday: Bool)
    case unavailable

    var isSettled: Bool {
      if case .loading = self {
        return false
      }

      return true
    }
  }

  var body: some View {
    Group {
      if let mock = placementMock, phase.isSettled {
        switch mock.status {
        case .running:
          mockRunning(mock.id)
        case .finished:
          outcome(
            title: Text(
              "Your mock exam set your starting point", tableName: "Onboarding",
              comment: "Placement ended with a mock exam"),
            description: Text(
              "Based on your \(shown.answered) answers. It gets more accurate every day.",
              tableName: "Onboarding", comment: "Under placement ended with a mock exam"))
        }
      } else {
        steps
      }
    }
    .task { await resume() }
    .onChange(of: isMockOpen) { _, isOpen in
      // Back from the mock: placement's answers are read again; the mock's state follows its read.
      if !isOpen {
        phase = .loading
        Task { await resume() }
      }
    }
    .modifier(PlacementMockLoading(goalId: view.goal.id, isExam: view.goal.kind == .exam))
  }

  @ViewBuilder
  private var steps: some View {
    switch phase {
    case .loading:
      ProgressView()
    case .intro:
      intro
    case .waiting:
      waiting
    case .question(let question, let labels):
      PlacementQuestionScreen(
        subject: subject, number: shown.answered + 1, progress: shown.spent, question: question,
        labels: labels, isSaving: isSaving, failed: failed,
        onAnswer: { submit($0, to: question) }, onStop: { finish(fromScratch: false) }
      )
      .id(question.itemId)
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

  private var placementMock: MockOptions.Placement.Mock? {
    guard view.goal.kind == .exam else {
      return nil
    }

    return exam.mockOptions(goalId: view.goal.id).value?.placement?.mock
  }

  private func mockRunning(_ mockID: String) -> some View {
    Form {
      StepHeader(
        title: Text(
          "Your mock exam is waiting", tableName: "Onboarding",
          comment: "A placement mock left running"),
        description: Text(
          "Go on where you left it, or stop now: your plan starts from the questions you answered.",
          tableName: "Onboarding", comment: "Under a placement mock left running"))

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
        canSkip: !isSaving,
        continueLabel: Text(
          "Continue the mock exam", tableName: "Mock", comment: "A running placement mock"),
        skipLabel: Text(
          "Stop and see my plan", tableName: "Onboarding",
          comment: "Stops a placement mock; its answers set the starting point"),
        onContinue: { router.open(.mock(blockId: mockID)) },
        onSkip: { stopMock(mockID) })
    }
    .onboardingColumn()
  }

  private var isMockOpen: Bool {
    router.tasks.contains { route in
      switch route {
      case .placementMock, .mock: true
      default: false
      }
    }
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

      if view.goal.kind == .exam {
        PlacementMockOffer(goalId: view.goal.id)
      }

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
    }
    .onboardingColumn()
    .disabled(isSaving)
  }

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

      if isWaitLost {
        GenerationFailureSection(failure: .connection) {
          isWaitLost = false
          waitRound += 1
        }
      } else {
        Section {
          ProgressView()
            .frame(maxWidth: .infinity)
        }
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
    .onboardingColumn()
    .disabled(isSaving)
    .task(id: waitRound) { await waitForQuestions() }
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
    .onboardingColumn()
    .disabled(isSaving)
  }

  private func resume() async {
    guard case .loading = phase else {
      return
    }

    guard let placement = try? await onboarding.placement(goalID: view.goal.id) else {
      phase = .intro
      return
    }

    // A mock's answers count too, for the line under its outcome.
    shown.answered = max(shown.answered, placement.answered)

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

    if !Task.isCancelled, case .waiting = phase {
      isWaitLost = true
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
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }

  private func stopMock(_ mockID: String) {
    guard !isSaving else {
      return
    }

    isSaving = true
    failed = false

    Task {
      defer { isSaving = false }

      do {
        // Stopping the mock keeps its answers, which set where the plan starts.
        let stopped = await exam.write(
          invalidating: [.goals, .learnerModel, .userProgress, .userSession]
        ) { api, token in
          try await api.finish(token: token, blockId: mockID)
        }

        switch stopped {
        case .done:
          try await onboarding.finishPlacement(goalID: view.goal.id, fromScratch: false)
          onDone()
        case .failed:
          failed = true
        case .obsolete:
          break
        }
      } catch is CancellationError {
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
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }
}

/// A new question gets a fresh view (`.id`), so nothing picked carries over.
struct PlacementQuestionScreen<Media: View>: View {
  var subject: String?
  let number: Int
  /// From 0 to 1.
  let progress: Double
  let question: PracticeQuestion
  var labels = PracticeTrueFalseLabels.trueFalse
  var dontKnowLabel = LocalizedStringResource(
    "I don't know yet", table: "Onboarding",
    comment: "Answers a placement question without guessing")
  let isSaving: Bool
  let failed: Bool
  let onAnswer: (PracticeAnswer) -> Void
  let onStop: () -> Void
  @ViewBuilder var media: () -> Media

  @State private var draft: PracticeAnswer?

  var body: some View {
    PracticeTaskLayout {
      VStack(alignment: .leading, spacing: 4) {
        if let subject {
          Text(subject)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        Text(
          "Question \(number)", tableName: "Onboarding",
          comment: "Which placement question this is"
        )
        .font(.subheadline.weight(.semibold))
      }

      ProgressView(value: progress)
        .tint(.success)
        .accessibilityHidden(true)

      media()

      PracticeQuestionView(question: question, labels: labels, draft: $draft) { answer in
        onAnswer(answer)
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
        isBusy: isSaving, isDisabled: draft?.complete == nil || isSaving
      ) {
        if let answer = draft?.complete {
          onAnswer(answer)
        }
      }

      PracticeSecondaryButton(
        title: dontKnowLabel, systemImage: "questionmark.circle", isDisabled: isSaving
      ) {
        onAnswer(.dontKnow)
      }

      Button(action: onStop) {
        Text("Stop here and see my plan", tableName: "Onboarding", comment: "Ends placement early")
      }
      .disabled(isSaving)
    }
  }
}

extension PlacementQuestionScreen where Media == EmptyView {
  init(
    subject: String?,
    number: Int,
    progress: Double,
    question: PracticeQuestion,
    labels: PracticeTrueFalseLabels,
    isSaving: Bool,
    failed: Bool,
    onAnswer: @escaping (PracticeAnswer) -> Void,
    onStop: @escaping () -> Void
  ) {
    self.init(
      subject: subject, number: number, progress: progress, question: question, labels: labels,
      isSaving: isSaving, failed: failed, onAnswer: onAnswer, onStop: onStop, media: { EmptyView() }
    )
  }
}
