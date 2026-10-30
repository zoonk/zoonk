import SwiftUI

/// Writes its questions first when the bank holds too few, only on the learner's tap. Plus-only
/// challenges stay visible with a lock.
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
      .taskClose {
        PracticeCloseButton { dismiss() }
      }
    }
    .task(id: session.authenticatedSession) { await read() }
    .onDisappear { action?.cancel() }
  }

  private func intro(_ challenge: Components.Schemas.Challenge) -> some View {
    // Once beaten, the Trickster's checkpoint says how it went, never the rules of a duel already
    // played, as on main.
    let won = isCheckpoint(challenge) && challenge.status == .done

    return PracticeTaskLayout {
      if isTrickster(challenge) {
        TricksterCharacter(beaten: won, reacts: !won)
          .frame(width: 112, height: 112)
      }

      VStack(alignment: .leading, spacing: 8) {
        if let eyebrow = eyebrow(challenge) {
          Text(eyebrow)
            .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
        }

        titleText(challenge).font(.largeTitle.bold())

        if won {
          if let result = challenge.result {
            Group {
              if challenge.call != nil {
                Text(
                  "\(result.correct) of \(result.total) goals", tableName: "Practice",
                  comment: "How a passed challenge call went, as in “2 of 3 goals”.")
              } else {
                Text(
                  "\(result.correct) of \(result.total) right", tableName: "Practice",
                  comment: "How a won challenge went, as in “8 of 10 right”.")
              }
            }
            .font(.subheadline.monospacedDigit())
            .foregroundStyle(.secondary)
          }
        } else {
          Text(description(challenge)).foregroundStyle(.secondary)

          if !facts(challenge).isEmpty {
            Text(facts(challenge).joined(separator: " · "))
              .font(.subheadline.monospacedDigit())
              .foregroundStyle(.secondary)
          }
        }
      }

      if let result = challenge.result, challenge.status == .done, !won {
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

      if let rule = duelRule(challenge) {
        Text(rule).font(.footnote).foregroundStyle(.secondary)
      }

      if challenge.reward.brainPower > 0, !won {
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
            "Moved to \(Self.weekdayDay(date))", tableName: "Practice",
            comment:
              "A weekly challenge moved later, to the next Monday; the argument is that day, like 'Monday, May 5'."
          )
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
    .navigationTitle(titleText(challenge))
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
    } else if challenge.status == .ready || challenge.status == .started {
      PracticeActionRow {
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
    challenge.locked || challenge.status == .plusRequired
      || challenge.canMove
      || challenge.waitReason != nil
      || [.ready, .started].contains(challenge.status)
      || ([.done, .tried].contains(challenge.status) && challenge.blockId != nil)
  }

  private func isCheckpoint(_ challenge: Components.Schemas.Challenge) -> Bool {
    challenge.kind != .weekly && !challenge.mock
  }

  private func isTrickster(_ challenge: Components.Schemas.Challenge) -> Bool {
    isCheckpoint(challenge) && challenge.call == nil
  }

  private func eyebrow(_ challenge: Components.Schemas.Challenge) -> String? {
    let phase = challenge.phase.map { $0.value1.index + 1 }

    guard isCheckpoint(challenge) else {
      return when(challenge)
    }

    let name =
      if challenge.kind == .finalBoss {
        String(
          localized: "Final challenge", table: "Practice",
          comment: "Title of the final challenge block.")
      } else if let phase {
        String(
          localized: "Phase \(phase) challenge", table: "Practice",
          comment: "Eyebrow naming a phase's checkpoint, as in “Phase 2 challenge”.")
      } else {
        String(
          localized: "Phase challenge", table: "Practice",
          comment: "Title of a phase challenge block.")
      }

    return challenge.rematch
      ? String(
        localized: "New try · \(name)", table: "Practice",
        comment: "Eyebrow of a lost checkpoint's rematch; the argument names the checkpoint.")
      : name
  }

  /// A mock always says when it is; a weekly challenge only once it has a start time, as on main.
  private func when(_ challenge: Components.Schemas.Challenge) -> String? {
    guard let date = challenge.date, challenge.mock || challenge.startTime != nil else {
      return nil
    }

    return [dayLabel(date, today: challenge.today), challenge.startTime.flatMap(clockTime)]
      .compactMap(\.self)
      .joined(separator: " · ")
  }

  private func clockTime(_ text: String) -> String? {
    let parts = text.split(separator: ":").compactMap { Int($0) }
    guard parts.count >= 2,
      let date = Calendar(identifier: .gregorian).date(
        from: DateComponents(
          timeZone: .gmt, year: 2000, month: 1, day: 1, hour: parts[0], minute: parts[1]))
    else {
      return nil
    }

    return date.formatted(Date.FormatStyle(timeZone: .gmt).hour().minute())
  }

  private func duelRule(_ challenge: Components.Schemas.Challenge) -> LocalizedStringResource? {
    if challenge.mock || challenge.call != nil {
      return nil
    }

    if challenge.kind == .weekly {
      return LocalizedStringResource(
        "You'll see right or wrong after each answer, and why at the end.", table: "Practice",
        comment: "How a weekly challenge gives feedback, on its intro.")
    }

    return challenge.status == .done
      ? nil
      : LocalizedStringResource(
        "You'll see right or wrong after each answer, and why at the end, with the traps he set.",
        table: "Practice", comment: "How a phase challenge gives feedback, on its intro.")
  }

  private func titleText(_ challenge: Components.Schemas.Challenge) -> Text {
    if let title = challenge.call?.title, challenge.status != .done, isCheckpoint(challenge) {
      Text(title)
    } else {
      Text(title(challenge))
    }
  }

  private func title(_ challenge: Components.Schemas.Challenge) -> LocalizedStringResource {
    if challenge.mock, let number = challenge.number {
      return LocalizedStringResource(
        "Mock exam \(number)", table: "Practice", comment: "Title of a numbered mock exam.")
    }

    if challenge.call != nil, isCheckpoint(challenge) {
      return challenge.status == .done
        ? LocalizedStringResource(
          "Challenge passed", table: "Practice", comment: "A finished challenge.")
        : LocalizedStringResource(
          "The unit's call", table: "Practice",
          comment: "Title of a language goal's challenge call before it's written.")
    }

    if isTrickster(challenge) {
      return challenge.status == .done
        ? LocalizedStringResource(
          "You beat the Trickster!", table: "Practice", comment: "A won phase challenge.")
        : LocalizedStringResource(
          "The Trickster", table: "Practice", comment: "Title of a phase or final checkpoint duel.")
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

    if let date = challenge.date, challenge.status == .upcoming, when(challenge) == nil {
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

  private static func parseDay(_ day: String) -> Date? {
    try? Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day().parse(day)
  }

  private static func weekdayDay(_ day: String) -> String {
    guard let date = parseDay(day) else { return day }

    var style = Date.FormatStyle.dateTime.weekday(.wide).month(.abbreviated).day()
    style.timeZone = .gmt
    return date.formatted(style)
  }

  private func dayLabel(_ day: String, today: String) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .gmt

    guard let date = Self.parseDay(day), let now = Self.parseDay(today) else { return day }

    let days = calendar.dateComponents([.day], from: now, to: date).day ?? 0

    if days == 0 {
      return String(
        localized: "Today", table: "Practice", comment: "A challenge planned for today.")
    }
    if days == 1 {
      return String(
        localized: "Tomorrow", table: "Practice", comment: "A challenge planned for tomorrow.")
    }

    return Self.weekdayDay(day)
  }

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

      // A call that has its block opens on the call's own intro, as main's challenge page does.
      if challenge.call != nil, let blockId = challenge.blockId, challenge.status != .done,
        !challenge.locked
      {
        dismiss()
        hooks.navigate(.checkpoint(blockId: blockId, sessionId: sessionId))
        return
      }

      load = .loaded(challenge)
    } catch let error as APIError {
      if error == .unauthorized { await session.expire(identity) }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }

  /// A learner who left (the screen closed, signed out) gets nothing opened or started behind them.
  private func start(afterWriting: Bool) async {
    isStarting = true
    startProblem = nil
    defer { isStarting = false }

    let planItemId = itemId
    let started = await practice.write(.answered) { identity in
      try await practice.api.startChallenge(
        token: identity.bearerToken, planItemId: planItemId, afterWriting: afterWriting)
    }

    switch started {
    case .done(let start):
      // Closed while the start was answered: nothing opens behind the learner.
      guard !Task.isCancelled else { return }
      dismiss()

      switch start.kind {
      case .checkpoint:
        hooks.navigate(.checkpoint(blockId: start.blockId, sessionId: start.sessionId))
      case .mock: hooks.navigate(.mock(blockId: start.blockId, sessionId: start.sessionId))
      }
    case .refused(.conflict(let code)) where code == "QUESTIONS_NEEDED" && !afterWriting:
      await writeThenStart()
    case .refused:
      // Plus, today's study time or the day changed since the intro opened: read it again.
      await read()
    case .failed:
      startProblem = Self.notDone
    case .obsolete:
      break
    }
  }

  /// Follows the run until it ends whether every call succeeded or not, then starts with what was
  /// written.
  private func writeThenStart() async {
    isWriting = true
    defer { isWriting = false }

    let planItemId = itemId
    let written = await practice.write(.answered) { identity in
      if case .generating(let generationId) = try await practice.api.writeChallenge(
        token: identity.bearerToken, planItemId: planItemId)
      {
        try? await practice.api.waitForQuestions(
          token: identity.bearerToken, generationId: generationId,
          readyStep: "challengeQuestionsReady")
      }
    }

    switch written {
    case .done:
      guard !Task.isCancelled else { return }
      isWriting = false
      await start(afterWriting: true)
    case .refused:
      await read()
    case .failed:
      startProblem = Self.notDone
    case .obsolete:
      break
    }
  }

  private func move() async {
    isMoving = true
    moveProblem = nil
    defer { isMoving = false }

    let planItemId = itemId
    switch await practice.write(
      .planChanged,
      { identity in
        try await practice.api.moveChallenge(token: identity.bearerToken, planItemId: planItemId)
      })
    {
    case .done(let moved):
      currentPlanItemId = moved.planItemId ?? planItemId
      movedChangeId = moved.changeId
      await read()
    case .refused(.invalid(let reason)):
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
    case .refused, .failed:
      moveProblem = Self.notDone
    case .obsolete:
      break
    }
  }

  private func undoMove(_ changeId: String) async {
    isMoving = true
    defer { isMoving = false }

    let movedItemId = itemId
    switch await practice.write(
      .planChanged,
      { identity in
        try await practice.api.undoChallengeMove(
          token: identity.bearerToken, planItemId: movedItemId, changeId: changeId)
      })
    {
    case .done(let undone):
      currentPlanItemId = undone.planItemId ?? planItemId
      movedChangeId = nil
      await read()
    case .refused, .failed:
      moveProblem = Self.notDone
    case .obsolete:
      break
    }
  }

  private static let notDone = LocalizedStringResource(
    "That didn't go through. Try again in a moment.", table: "Practice",
    comment: "A challenge's start or move failed.")
}
