import SwiftUI

struct MistakeLessonQuestionView: View {
  let replay: MistakeLessonReplay
  let entry: MistakePracticeEntry
  let segments: [TaskSegment]
  let index: Int
  let goalId: String?
  let answerIds: [String]
  let checking: () -> Void
  let failed: () -> Void
  let answered: (MistakePracticeGrade) -> Void
  let next: () -> Void

  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceFocus) private var focuses
  @State private var state: LessonPlayerState
  @State private var work = ActivityWork()
  @State private var cantTalk = LessonTodayChoices.standard.isChosenToday(.cantTalk)
  @State private var micBlocked = false
  @State private var attemptId = UUID().uuidString.lowercased()
  @State private var sent: LessonAnswer?
  @State private var sentDuration: Int?
  @State private var showsIdea: Bool
  @State private var sentDontKnow = false
  @State private var sentTimedOut = false
  @State private var speechChecking = false
  @State private var showsSaveReport = false
  @State private var pressedWithFocus: PracticeFocus?
  @State private var grade: MistakePracticeGrade?
  @State private var failures = 0
  @State private var shownAt = Date.now

  init(
    replay: MistakeLessonReplay, entry: MistakePracticeEntry, segments: [TaskSegment], index: Int,
    goalId: String?, answerIds: [String], checking: @escaping () -> Void,
    failed: @escaping () -> Void, answered: @escaping (MistakePracticeGrade) -> Void,
    next: @escaping () -> Void
  ) {
    self.replay = replay
    self.entry = entry
    self.segments = segments
    self.index = index
    self.goalId = goalId
    self.answerIds = answerIds
    self.checking = checking
    self.failed = failed
    self.answered = answered
    self.next = next
    _showsIdea = State(initialValue: entry.drill.isIdeaFirst)
    _state = State(initialValue: LessonPlayerState(lessonId: replay.lessonId, steps: [replay.step]))
  }

  private var context: LessonStepContext {
    LessonStepContext(
      lessonId: replay.lessonId, answer: state.currentAnswer, result: state.currentResult,
      isLocked: state.phase != .playing, waitsForPicture: false,
      select: { state.select($0, for: replay.step.id) }, resolveSpoken: resolveSpoken,
      check: canCheck ? check : nil)
  }

  private var announcement: String? {
    guard let result = state.currentResult else { return nil }
    return [String(localized: LessonVerdict.of(result, step: replay.step).title), result.feedback]
      .compactMap { $0 }.joinedSentences()
  }

  private func press(_ control: PracticeFocus) {
    pressedWithFocus = focuses?.has(control) == true ? control : nil
  }

  private var tutorAnswer: LessonAnswer? {
    guard grade?.lessonResult?.checked == true else { return nil }
    return state.currentAnswer ?? state.currentResult?.answerText.map { .spokenAnswer(text: $0) }
  }

  private func resolveSpoken(_ verdict: SpokenAnswerVerdict) {
    guard var result = state.currentResult else { return }
    result.answerText = verdict.transcript
    result.heard = verdict.heard
    state.showReplayResult(replay.step.id, result: result)
  }

  private func check() { Task { await send() } }

  private var canCheck: Bool {
    !speechChecking && state.phase == .playing
      && replay.step.canCheck(state.currentAnswer, openedAt: shownAt)
  }

  var body: some View {
    PracticeTaskLayout(segments: segments, index: index) {
      if showsIdea, let lesson = entry.drill.lesson {
        DrillIdeaView(drill: entry.drill, lesson: lesson)
      } else {
        DrillNoteView(
          drill: entry.drill, lastAnswer: entry.snapshotAnswer,
          isAnswered: grade != nil || entry.drill.isIdeaFirst)
        if let seconds = entry.drill.timeLimitSeconds, grade == nil, state.phase == .playing {
          DrillCountdownView(seconds: seconds, start: shownAt) {
            Task { await send(dontKnow: true, timedOut: true) }
          }
        }
        content(.screen)
      }
    } response: {
      if !showsIdea { content(.turn) }
      if let result = state.currentResult {
        LessonVerdictView(
          step: replay.step, answer: state.currentAnswer, result: result, willReturn: false)
        DrillAnswerNotes(
          drill: entry.drill, notSure: grade?.notSure == true,
          timedOut: sentTimedOut, trap: grade?.trap)
      }
    } actions: {
      PracticeActionRow {
        if showsIdea {
          PracticeMainButton(
            title: LocalizedStringResource(
              "Start the questions", table: "Practice",
              comment: "Starts a content-gap drill's questions after its idea."), icon: .play
          ) {
            showsIdea = false
            shownAt = .now
          }
        } else if grade != nil {
          PracticeMainButton(
            title: LocalizedStringResource(
              "Continue", table: "Practice", comment: "Moves on after a grade."),
            icon: .forward, action: next
          )
          .practiceFocus(.next)
        } else {
          PracticeSecondaryButton(
            title: entry.drill.kind == .noGuessing
              ? LocalizedStringResource(
                "I'm not sure", table: "Practice",
                comment: "Honest way out of a guess in a no-guessing drill.")
              : LocalizedStringResource(
                "I don't know yet", table: "Practice",
                comment: "Answers a question as not known yet."),
            icon: .notSure, isDisabled: speechChecking || state.phase != .playing
          ) {
            press(.notSure)
            Task { await send(dontKnow: true) }
          }
          .practiceFocus(.notSure)
          if failures > 0 {
            PracticeSaveError(
              failures: failures, onReport: { showsSaveReport = true },
              retry: { Task { await send(retry: true) } })
          }
          if case .challenge(let challenge) = replay.step.content,
            !isChallengeEnded(challenge)
          {
            PracticeMainButton(
              title: LocalizedStringResource(
                "Continue", table: "Practice", comment: "Moves on after a grade."),
              icon: .forward, isDisabled: !challengeCanContinue(challenge)
            ) { state.continueLesson() }
          } else {
            PracticeMainButton(
              title: LocalizedStringResource(
                "Check", table: "Practice", comment: "Sends the answer to be graded."),
              icon: .check, isBusy: state.phase == .checking, isDisabled: !canCheck
            ) {
              press(.check)
              Task { await send() }
            }
            .practiceFocus(.check)
          }
        }
        if !showsIdea && entry.tutorAvailable {
          TutorAskButton(
            scope: .step(
              lessonId: replay.lessonId, stepId: replay.step.id,
              stepNumber: replay.step.position + 1,
              answer: tutorAnswer,
              suggestions: [], mistakeId: entry.mistakeId), iconOnly: grade?.isCorrect != false)
        }
      }
    }
    .environment(work)
    .announcesStatus(announcement)
    .onChange(of: grade) { _, grade in
      if grade != nil, pressedWithFocus != nil {
        focuses?.move(to: .next)
        pressedWithFocus = nil
      }
    }
    .feedbackSheet(
      isPresented: $showsSaveReport,
      context: FeedbackContext(screen: "mistake-practice", reportType: .saveFailure), isReport: true
    )
    .onChange(of: cantTalk) { _, value in
      LessonTodayChoices.standard.setChosenToday(.cantTalk, value)
    }
  }

  private func content(_ part: LessonStepPart) -> some View {
    LessonQuestionStepView(
      step: replay.step, state: state, context: context, part: part,
      cantTalk: $cantTalk, micBlocked: $micBlocked,
      mistake: SpokenMistakeTarget(
        mistakeId: entry.mistakeId, attemptId: attemptId,
        goalId: goalId, answerIds: answerIds, questionStartedAt: shownAt),
      onPracticeGraded: { feedback in
        if let result = try? MistakePracticeGrade(feedback) { show(result) }
      },
      onCheckingChanged: { busy in
        speechChecking = busy
        if busy { checking() } else if grade == nil { failed() }
      })
  }

  private func isChallengeEnded(_ content: ChallengeContent) -> Bool {
    if case .ended = ChallengeProgress(
      content: content,
      picks: state.challengePicks(replay.step.id), shown: state.revealed[replay.step.id] ?? 0)
    {
      true
    } else {
      false
    }
  }

  private func challengeCanContinue(_ content: ChallengeContent) -> Bool {
    switch ChallengeProgress(
      content: content,
      picks: state.challengePicks(replay.step.id), shown: state.revealed[replay.step.id] ?? 0)
    {
    case .intro: true
    case .deciding(_, _, _, let pending): pending != nil
    case .ended: false
    }
  }

  private func show(_ feedback: MistakePracticeGrade) {
    var result = feedback
    result.notSure = sentDontKnow && !sentTimedOut
    result.lessonResult?.isSampleAnswer = result.notSure
    grade = result
    if let lessonResult = result.lessonResult {
      state.showReplayResult(replay.step.id, result: lessonResult)
    }
    answered(result)
  }

  private func send(retry: Bool = false, dontKnow: Bool = false, timedOut: Bool = false) async {
    guard !speechChecking, state.phase == .playing, dontKnow || retry || canCheck else { return }
    let isDontKnow = retry ? sentDontKnow : dontKnow
    let answer = isDontKnow ? nil : (retry ? sent : state.currentAnswer)
    if sentDuration != nil && (sent != answer || sentDontKnow != isDontKnow) {
      attemptId = UUID().uuidString.lowercased()
      sentDuration = nil
    }
    sent = answer
    sentDontKnow = isDontKnow
    if !retry { sentTimedOut = timedOut }
    if isDontKnow { state.select(nil, for: replay.step.id) }
    if sentDuration == nil { sentDuration = Int(Date.now.timeIntervalSince(shownAt) * 1000) }
    state.startReplayChecking()
    checking()
    switch await practice.write(
      .answered,
      { identity in
        try await practice.api.answerLessonMistake(
          token: identity.bearerToken, mistakeId: entry.mistakeId, stepId: replay.step.id,
          answer: answer, durationMs: sentDuration ?? 0,
          attemptId: attemptId, runAnswerIds: answerIds, goalId: goalId)
      })
    {
    case .done(let result):
      show(result)
    case .failed, .refused:
      failures += 1
      state.failChecking()
      if let pressedWithFocus { focuses?.move(to: pressedWithFocus) }
      failed()
    case .obsolete: break
    }
  }
}
