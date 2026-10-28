import SwiftUI

/// A challenge's intro: the phase challenge (the Trickster), the final one, or the week's Big
/// Challenge. It says what it asks and what it's worth, starts on its day (writing its questions
/// first when the bank holds too few, on the learner's tap), moves the weekly one to Monday with
/// an undo, and keeps Plus-only challenges visible with a lock and a way to Plus.
struct ChallengeScreen: View {
  let planItemId: String
  var sessionId: String?

  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceHooks) private var hooks
  @Environment(\.dismiss) private var dismiss
  @State private var currentPlanItemId: String?
  @State private var load: PracticeLoad<Components.Schemas.Challenge> = .loading
  @State private var isStarting = false
  @State private var isWriting = false
  @State private var startProblem: LocalizedStringResource?
  @State private var isMoving = false
  @State private var moveProblem: LocalizedStringResource?
  @State private var movedChangeId: String?
  /// The start, move or undo in flight: cancelled when the screen goes away, so a closed challenge
  /// never opens its checkpoint or starts the next request later.
  @State private var action: Task<Void, Never>?

  init(planItemId: String, sessionId: String? = nil) {
    self.planItemId = planItemId
    self.sessionId = sessionId
  }

  private var itemId: String { currentPlanItemId ?? planItemId }

  var body: some View {
    NavigationStack {
      Group {
        switch load {
        case .loading:
          ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let error):
          PracticeLoadFailureView(error: error) { Task { await read() } }
        case .loaded(let challenge):
          intro(challenge)
        }
      }
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          PracticeCloseButton { dismiss() }
        }
      }
    }
    // Loads once the session (and the active goal) is known, and again if it changes: a screen
    // opened at launch can appear before the session is restored.
    .task(id: session.authenticatedSession) { await read() }
    .onDisappear { action?.cancel() }
  }

  // MARK: Intro

  private func intro(_ challenge: Components.Schemas.Challenge) -> some View {
    PracticeTaskLayout {
      VStack(alignment: .leading, spacing: 8) {
        if let phase = challenge.phase?.value1, challenge.kind != .weekly {
          Text(
            "Phase \(phase.index + 1)", tableName: "Practice",
            comment: "Eyebrow naming a phase challenge's phase."
          )
          .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
        }

        Text(title(challenge)).font(.largeTitle.bold())
        Text(description(challenge)).foregroundStyle(.secondary)

        if !facts(challenge).isEmpty {
          Text(facts(challenge).joined(separator: " · "))
            .font(.subheadline.monospacedDigit())
            .foregroundStyle(.secondary)
        }
      }

      if let result = challenge.result, challenge.status == .done {
        Label {
          Text(
            result.passed
              ? LocalizedStringResource(
                "You beat the Trickster!", table: "Practice", comment: "A won phase challenge.")
              : LocalizedStringResource(
                "Challenge passed", table: "Practice", comment: "A finished challenge.")
          )
          Text("\(result.correct)/\(result.total)").monospacedDigit()
        } icon: {
          Image(systemName: "checkmark.seal")
        }
      }

      if !challenge.topics.isEmpty {
        VStack(alignment: .leading, spacing: 6) {
          Text(
            challenge.kind == .weekly
              ? LocalizedStringResource(
                "This week's topics", table: "Practice",
                comment: "Heading over a weekly challenge's topics.")
              : challenge.status == .done
                ? LocalizedStringResource(
                  "What he asked", table: "Practice",
                  comment: "Heading over a finished phase challenge's topics.")
                : LocalizedStringResource(
                  "What he'll ask", table: "Practice",
                  comment: "Heading over a phase challenge's topics.")
          )
          .font(.headline)

          ForEach(Array(challenge.topics.enumerated()), id: \.offset) { _, topic in
            HStack(alignment: .firstTextBaseline) {
              Text(topic.name)
              if let subject = topic.subject {
                Spacer()
                Text(subject).font(.footnote).foregroundStyle(.secondary)
              }
            }
          }
        }
      }

      if challenge.reward.brainPower > 0 {
        Label {
          Text(
            "+\(challenge.reward.brainPower) Brain Power", tableName: "Practice",
            comment: "A challenge's Brain Power reward.")
        } icon: {
          Image(systemName: "brain.head.profile")
        }
        .foregroundStyle(.brain)
      }

      if challenge.locked || challenge.status == .plusRequired {
        PracticeCallout(systemImage: "lock.fill") {
          Text(plusLine(challenge))
        }
      }

      if challenge.dailyLimitReached {
        PracticeCallout(systemImage: "hourglass") {
          Text(
            challenge.canMove
              ? LocalizedStringResource(
                "You've reached today's study time. Move it to Monday to keep it.",
                table: "Practice",
                comment: "A weekly challenge can't start today: the daily limit is reached.")
              : LocalizedStringResource(
                "You've reached today's study time.", table: "Practice",
                comment: "A challenge can't start today: the daily limit is reached.")
          )
        }
      }

      if isWriting {
        HStack(spacing: 12) {
          ProgressView()
          VStack(alignment: .leading) {
            Text(
              "Getting your challenge ready", tableName: "Practice",
              comment: "While a challenge's questions are written."
            )
            .font(.headline)
            Text(
              "We're writing its questions. It starts here when they're ready.",
              tableName: "Practice",
              comment: "A challenge waits for its questions."
            )
            .font(.subheadline).foregroundStyle(.secondary)
          }
        }
      }

      if let startProblem {
        Text(startProblem).font(.subheadline).foregroundStyle(.destructive)
      }

      if let moveProblem {
        Text(moveProblem).font(.subheadline).foregroundStyle(.destructive)
      }

      if let movedChangeId, let date = challenge.date {
        HStack {
          Text(
            "Moved to \(dayLabel(date, today: challenge.today))", tableName: "Practice",
            comment: "A weekly challenge moved to another day.")
          Spacer()
          Button {
            run { await undoMove(movedChangeId) }
          } label: {
            Text("Undo", tableName: "Practice", comment: "Undoes moving a weekly challenge.")
          }
          .buttonStyle(.bordered)
          .disabled(isMoving)
        }
      }
    } actions: {
      actions(challenge)
    }
    .practiceActionsHidden(!hasActions(challenge))
    .navigationTitle(Text(title(challenge)))
  }

  @ViewBuilder
  private func actions(_ challenge: Components.Schemas.Challenge) -> some View {
    if challenge.locked || challenge.status == .plusRequired {
      PracticeMainButton(
        title: LocalizedStringResource(
          "See Plus", table: "Practice", comment: "Opens the Plus subscription.")
      ) {
        hooks.navigate(.subscription)
      }
    } else if challenge.status == .done || challenge.status == .tried,
      let blockId = challenge.blockId
    {
      PracticeMainButton(
        title: LocalizedStringResource(
          "See how it went", table: "Practice", comment: "Opens a finished checkpoint's result.")
      ) {
        dismiss()
        hooks.navigate(.checkpoint(blockId: blockId, sessionId: sessionId))
      }
    } else if challenge.call != nil {
      if let call = hooks.challengeCall {
        call(itemId)
      } else {
        Text(
          "This challenge isn't ready yet.", tableName: "Practice",
          comment: "A challenge that can't start on this device yet."
        )
        .font(.subheadline).foregroundStyle(.secondary)
      }
    } else if challenge.status == .ready || challenge.status == .started {
      HStack(spacing: 12) {
        if challenge.canMove, movedChangeId == nil {
          PracticeSecondaryButton(
            title: LocalizedStringResource(
              "Move to Monday", table: "Practice",
              comment: "Moves the weekly challenge to next Monday."),
            isDisabled: isMoving || isStarting
          ) { run { await move() } }
        }

        PracticeMainButton(
          title: challenge.mock
            ? LocalizedStringResource(
              "Start the mock exam", table: "Practice", comment: "Starts a mock exam challenge.")
            : LocalizedStringResource("Start", table: "Practice", comment: "Starts a challenge."),
          isBusy: isStarting || isWriting,
          isDisabled: challenge.dailyLimitReached
        ) { run { await start(afterWriting: false) } }
      }
    } else if challenge.canMove, movedChangeId == nil {
      PracticeSecondaryButton(
        title: LocalizedStringResource(
          "Move to Monday", table: "Practice", comment: "Moves the weekly challenge to next Monday."
        ),
        isDisabled: isMoving
      ) { run { await move() } }
    } else if challenge.waitReason != nil {
      Text(
        "Opens after this phase's lessons", tableName: "Practice",
        comment: "A phase challenge waiting for earlier lessons."
      )
      .font(.subheadline).foregroundStyle(.secondary)
    }
  }

  /// Before its day a challenge has nothing to do yet: no pinned bar.
  private func hasActions(_ challenge: Components.Schemas.Challenge) -> Bool {
    challenge.locked || challenge.status == .plusRequired || challenge.call != nil
      || challenge.canMove
      || challenge.waitReason != nil
      || [.ready, .started, .done, .tried].contains(challenge.status)
  }

  // MARK: Copy

  private func title(_ challenge: Components.Schemas.Challenge) -> LocalizedStringResource {
    if challenge.mock, let number = challenge.number {
      return LocalizedStringResource(
        "Mock exam \(number)", table: "Practice", comment: "Title of a numbered mock exam.")
    }

    switch challenge.kind {
    case .weekly:
      return LocalizedStringResource(
        "Weekly challenge", table: "Practice", comment: "Title of the weekly challenge block.")
    case .finalBoss:
      return LocalizedStringResource(
        "Final challenge", table: "Practice", comment: "Title of the final challenge block.")
    case .boss:
      return challenge.rematch
        ? LocalizedStringResource(
          "Challenge, second try", table: "Practice",
          comment: "Title of a lost phase challenge's rematch.")
        : LocalizedStringResource(
          "Phase challenge", table: "Practice", comment: "Title of a phase challenge block.")
    }
  }

  private func description(_ challenge: Components.Schemas.Challenge) -> LocalizedStringResource {
    if challenge.call != nil {
      return LocalizedStringResource(
        "A live call where you get your point across. Speak or type.", table: "Practice",
        comment: "What a challenge call is.")
    }

    if challenge.mock {
      return LocalizedStringResource(
        "Your result only shows at the end, like on exam day.", table: "Practice",
        comment: "What a mock exam challenge is.")
    }

    if challenge.kind == .weekly {
      return LocalizedStringResource(
        "Questions from what you studied this week, with no hints.", table: "Practice",
        comment: "What the weekly challenge asks.")
    }

    if (challenge.recordings ?? 0) > 0 {
      return LocalizedStringResource(
        "Questions on recordings from this phase, played as in the exam, with no hints.",
        table: "Practice",
        comment: "What a listening phase challenge asks.")
    }

    return LocalizedStringResource(
      "Mixed questions from this phase, with no hints.", table: "Practice",
      comment: "What a phase challenge asks.")
  }

  private func facts(_ challenge: Components.Schemas.Challenge) -> [String] {
    var facts: [String] = []

    if let questions = challenge.questions, questions > 0 {
      facts.append(
        String(
          localized: "\(questions) questions", table: "Practice",
          comment: "How many questions a test asks."))
    }

    if let passMark = challenge.passMark, challenge.kind != .weekly, passMark > 0 {
      facts.append(
        String(
          localized: "\(passMark) right to win", table: "Practice",
          comment: "A phase challenge's pass mark."))
    }

    if let minutes = challenge.estimatedMinutes ?? challenge.minutes {
      facts.append(
        Duration.seconds(minutes * 60).formatted(
          .units(allowed: [.hours, .minutes], width: .abbreviated)))
    }

    if let date = challenge.date, challenge.status == .upcoming {
      facts.append(dayLabel(date, today: challenge.today))
    }

    return facts
  }

  private func plusLine(_ challenge: Components.Schemas.Challenge) -> LocalizedStringResource {
    if challenge.call != nil {
      return LocalizedStringResource(
        "Challenge calls come with Plus. Your plan keeps going without them.", table: "Practice",
        comment: "A challenge call is Plus-only.")
    }

    return LocalizedStringResource(
      "Mock exams come with Plus: whenever you want, and every week in your plan.",
      table: "Practice",
      comment: "A mock exam challenge is Plus-only.")
  }

  /// "Today", "Tomorrow", or the weekday and date, for a learner-local day ("2026-11-02").
  private func dayLabel(_ day: String, today: String) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .gmt
    let parse = Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day()

    guard let date = try? parse.parse(day), let now = try? parse.parse(today) else { return day }

    let days = calendar.dateComponents([.day], from: now, to: date).day ?? 0

    if days == 0 {
      return String(
        localized: "Today", table: "Practice", comment: "A challenge planned for today.")
    }
    if days == 1 {
      return String(
        localized: "Tomorrow", table: "Practice", comment: "A challenge planned for tomorrow.")
    }

    var style = Date.FormatStyle.dateTime.weekday(.wide).month(.abbreviated).day()
    style.timeZone = .gmt
    return date.formatted(style)
  }

  // MARK: Requests

  private func run(_ work: @escaping @MainActor () async -> Void) {
    action?.cancel()
    action = Task { await work() }
  }

  private func read() async {
    guard let identity = session.authenticatedSession else { return }

    do {
      let challenge = try await practice.api.challenge(
        token: identity.bearerToken, planItemId: itemId)
      guard session.authenticatedSession == identity else { return }
      load = .loaded(challenge)
    } catch let error as APIError {
      if error == .unauthorized { await session.expire(identity) }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }

  /// Start plans today's session if needed and starts the block, then opens where it's played.
  /// Too few questions in the bank writes them first (the learner's tap), then starts with them.
  private func start(afterWriting: Bool) async {
    guard let identity = session.authenticatedSession else { return }

    isStarting = true
    startProblem = nil
    defer { isStarting = false }

    do {
      let start = try await practice.api.startChallenge(
        token: identity.bearerToken, planItemId: itemId, afterWriting: afterWriting)
      guard !Task.isCancelled else { return }
      practice.changed(.answered)
      dismiss()

      switch start.kind {
      case .checkpoint:
        hooks.navigate(.checkpoint(blockId: start.blockId, sessionId: start.sessionId))
      case .mock: hooks.navigate(.mock(blockId: start.blockId, sessionId: start.sessionId))
      }
    } catch PracticeAPIError.conflict(let code) where code == "QUESTIONS_NEEDED" && !afterWriting {
      await writeThenStart(identity: identity)
    } catch PracticeAPIError.plusRequired {
      await read()
    } catch PracticeAPIError.dailyLimitReached {
      await read()
    } catch PracticeAPIError.conflict {
      await read()
    } catch {
      startProblem = LocalizedStringResource(
        "That didn't go through. Try again in a moment.", table: "Practice",
        comment: "A challenge's start or move failed.")
    }
  }

  private func writeThenStart(identity: AuthenticatedSession) async {
    isWriting = true
    defer { isWriting = false }

    do {
      if case .generating(let generationId) = try await practice.api.writeChallenge(
        token: identity.bearerToken, planItemId: itemId)
      {
        try? await practice.api.waitForQuestions(
          token: identity.bearerToken, generationId: generationId,
          readyStep: "challengeQuestionsReady")
      }
    } catch PracticeAPIError.plusRequired {
      await read()
      return
    } catch {
      startProblem = LocalizedStringResource(
        "That didn't go through. Try again in a moment.", table: "Practice",
        comment: "A challenge's start or move failed.")
      return
    }

    // Closed meanwhile: the questions stay written, and nothing starts behind the learner.
    guard !Task.isCancelled else { return }

    isWriting = false
    await start(afterWriting: true)
  }

  /// "Move to Monday": the challenge moves through the plan and this screen follows it to its
  /// new plan item, with the move's undo.
  private func move() async {
    guard let identity = session.authenticatedSession else { return }

    isMoving = true
    moveProblem = nil
    defer { isMoving = false }

    do {
      let moved = try await practice.api.moveChallenge(
        token: identity.bearerToken, planItemId: itemId)
      currentPlanItemId = moved.planItemId ?? itemId
      movedChangeId = moved.changeId
      practice.changed(.planChanged)
      await read()
    } catch PracticeAPIError.invalid(let reason) {
      moveProblem =
        reason == "mockCollision"
        ? LocalizedStringResource(
          "That day already has a weekly challenge or mock exam, so this one stays where it is.",
          table: "Practice",
          comment: "Moving a weekly challenge was refused: the day already has one.")
        : LocalizedStringResource(
          "Your plan can't make room for this challenge on Monday. It stays where it is.",
          table: "Practice",
          comment: "Moving a weekly challenge was refused: no room on Monday.")
    } catch {
      moveProblem = LocalizedStringResource(
        "That didn't go through. Try again in a moment.", table: "Practice",
        comment: "A challenge's start or move failed.")
    }
  }

  private func undoMove(_ changeId: String) async {
    guard let identity = session.authenticatedSession else { return }

    isMoving = true
    defer { isMoving = false }

    do {
      let undone = try await practice.api.undoChallengeMove(
        token: identity.bearerToken, planItemId: itemId, changeId: changeId)
      currentPlanItemId = undone.planItemId ?? planItemId
      movedChangeId = nil
      practice.changed(.planChanged)
      await read()
    } catch {
      moveProblem = LocalizedStringResource(
        "That didn't go through. Try again in a moment.", table: "Practice",
        comment: "A challenge's start or move failed.")
    }
  }
}
