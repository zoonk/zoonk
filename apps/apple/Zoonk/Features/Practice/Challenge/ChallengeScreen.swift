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
  @State private var isStartSlow = false
  @State private var isWriting = false
  @State private var writeLimit: HelpLimit?
  @State private var startProblem: LocalizedStringResource?
  @State private var isMoving = false
  @State private var moveProblem: LocalizedStringResource?
  @State private var moved: Moved?
  /// The start, move or undo in flight: cancelled when the screen goes away, so a closed challenge
  /// never opens its checkpoint or starts the next request later.
  @State private var action: Task<Void, Never>?

  private struct Moved: Equatable {
    let changeId: String
    let effect: PlanEffect?
  }

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
        case .failed(.notFound):
          PracticeRedirect { hooks.navigate(.today) }
        case .failed(let error):
          PracticeLoadFailureView(error: error) { Task { await read() } }
        case .loaded(let challenge):
          if let blockId = callBlockId(challenge) {
            PracticeRedirect {
              dismiss()
              hooks.navigate(.checkpoint(blockId: blockId, sessionId: sessionId))
            }
          } else {
            intro(challenge)
          }
        }
      }
      .navigationTitle(title)
      .navigationBarTitleDisplayMode(.inline)
      .taskClose {
        PracticeCloseButton { dismiss() }
      }
    }
    .task(id: session.authenticatedSession) { await read() }
    .clearsRefusal { writeLimit = nil }
    // Writing the questions shows its own wait, and the start after it is timed afresh.
    .task(id: isStarting && !isWriting) {
      isStartSlow = false

      if isStarting, !isWriting {
        try? await Task.sleep(for: Self.slowStart)
        isStartSlow = !Task.isCancelled
      }
    }
    .announcesStatus(isStartSlow && isStarting && !isWriting ? Self.slowStartLine : nil)
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

      VStack(alignment: .leading, spacing: 6) {
        if challenge.rematch, isCheckpoint(challenge), challenge.status != .done {
          Chip(Text("Rematch", tableName: "Practice", comment: "Over a challenge's second go"))
            .padding(.bottom, 2)
        }

        titleText(challenge)
          .typeStyle(.pageTitle)
          .accessibilityAddTraits(.isHeader)

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
            .typeStyle(.data)
            .foregroundStyle(.mutedForeground)
          }
        } else {
          Text(description(challenge))
            .typeStyle(.reading)
            .foregroundStyle(.mutedForeground)
        }
      }

      if !won, let meta = meta(challenge) {
        Text(meta)
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }

      if isLocked(challenge) {
        gateWords(challenge)
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

      if !challenge.topics.isEmpty, !challenge.mock {
        // A closed row the learner can open: the intro is the character and one sentence.
        DisclosureGroup {
          ChallengeTopicRows(topics: challenge.topics.map { (name: $0.name, area: $0.subject) })
        } label: {
          Text(
            challenge.kind == .weekly
              ? LocalizedStringResource(
                "This week's topics", table: "Practice",
                comment: "Opens a weekly challenge's topics.")
              : challenge.status == .done
                ? LocalizedStringResource(
                  "What he asked", table: "Practice",
                  comment: "Opens a finished Trickster duel's topics.")
                : LocalizedStringResource(
                  "What he'll ask", table: "Practice", comment: "Opens a Trickster duel's topics.")
          )
          .typeStyle(.rowTitle)
        }
        .tint(.primary)
      }

      if isWriting {
        HStack(spacing: 12) {
          ProgressView()
          VStack(alignment: .leading) {
            Text(
              "Getting your challenge ready", tableName: "Practice",
              comment: "While a challenge's questions are written."
            )
            .typeStyle(.body.weight(.semibold))
            Text(
              "It starts here when it's ready.", tableName: "Practice",
              comment: "A challenge waits for its questions."
            )
            .typeStyle(.note).foregroundStyle(.mutedForeground)
          }
        }
      }

      if isStartSlow, isStarting, !isWriting {
        Text(Self.slowStartLine)
          .typeStyle(.note).foregroundStyle(.mutedForeground)
      }

      if let startProblem {
        FailureLine(message: startProblem).typeStyle(.body)
      }

      if let moveProblem {
        FailureLine(message: moveProblem).typeStyle(.body)
      }

      if let moved, let date = challenge.date {
        HStack(alignment: .firstTextBaseline) {
          VStack(alignment: .leading, spacing: 4) {
            Text(movedTo(date))
            Text(movedDetail(moved.effect))
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
          Spacer()
          BusyButton(isBusy: isMoving, icon: .undo) {
            run { await undoMove(moved.changeId) }
          } label: {
            Text("Undo", tableName: "Practice", comment: "Undoes moving a weekly challenge.")
          }
          .buttonStyle(.outline)
        }
      }
    } actions: {
      actions(challenge)
    }
    .practiceActionsHidden(!hasActions(challenge))
  }

  private func movedTo(_ day: String) -> String {
    String(
      localized: "Moved to \(Self.weekdayDay(day))", table: "Practice",
      comment:
        "A weekly challenge moved later, to the next Monday; the argument is that day, like 'Monday, May 5'."
    )
  }

  private var title: Text {
    guard case .loaded(let challenge) = load else {
      return Text(
        "Challenge", tableName: "Practice", comment: "Names a challenge's screen until it loads")
    }

    return titleText(challenge)
  }

  @ViewBuilder
  private func actions(_ challenge: Components.Schemas.Challenge) -> some View {
    if isLocked(challenge) {
      PracticeMainButton(
        title: LocalizedStringResource(
          "Subscribe", table: "Practice", comment: "Opens the subscription page."),
        icon: .forward
      ) {
        hooks.navigate(.subscription)
      }
    } else if challenge.status == .done || challenge.status == .tried,
      let blockId = challenge.blockId
    {
      PracticeMainButton(
        title: LocalizedStringResource(
          "See how it went", table: "Practice", comment: "Opens a finished checkpoint's result."),
        icon: .forward
      ) {
        dismiss()
        hooks.navigate(
          challenge.mock
            ? .mock(blockId: blockId, sessionId: sessionId)
            : .checkpoint(blockId: blockId, sessionId: sessionId))
      }
    } else if canStart(challenge) {
      if let writeLimit {
        HelpLimitNotice(limit: writeLimit)
          .frame(maxWidth: .infinity, alignment: .leading)
      }

      if writeLimit?.isShortBreak ?? true {
        PracticeActionRow {
          if challenge.canMove, moved == nil {
            PracticeSecondaryButton(
              title: LocalizedStringResource(
                "Move to Monday", table: "Practice",
                comment: "Moves the weekly challenge to next Monday."),
              icon: .setDate, isBusy: isMoving, isDisabled: isStarting
            ) { run { await move() } }
          }

          PracticeMainButton(
            title:
              LocalizedStringResource("Start", table: "Practice", comment: "Starts a challenge."),
            icon: .play, isBusy: isStarting || isWriting,
            isDisabled: isMoving
          ) { run { await start(afterWriting: false) } }
        }
      }
    } else {
      if let wait = waitLine(challenge) {
        Text(wait).typeStyle(.note).foregroundStyle(.mutedForeground)
      }

      if challenge.canMove, moved == nil {
        PracticeSecondaryButton(
          title: LocalizedStringResource(
            "Move to Monday", table: "Practice",
            comment: "Moves the weekly challenge to next Monday."),
          icon: .setDate, isBusy: isMoving
        ) { run { await move() } }
      }
    }
  }

  private func canStart(_ challenge: Components.Schemas.Challenge) -> Bool {
    [.ready, .started].contains(challenge.status) && challenge.waitReason == nil
  }

  /// Main's footer line for a challenge with nothing to start yet. A dated one already says its day
  /// above.
  private func waitLine(_ challenge: Components.Schemas.Challenge) -> LocalizedStringResource? {
    let waits = [.ready, .started].contains(challenge.status) && challenge.waitReason != nil

    guard waits || (challenge.status == .upcoming && challenge.date == nil) else {
      return nil
    }

    return LocalizedStringResource(
      "Opens when you finish the lessons before it", table: "Practice",
      comment: "A challenge waiting for the lessons before it.")
  }

  private func isLocked(_ challenge: Components.Schemas.Challenge) -> Bool {
    challenge.locked || challenge.status == .plusRequired
  }

  /// Before its day a challenge has nothing to do yet: no pinned bar.
  private func hasActions(_ challenge: Components.Schemas.Challenge) -> Bool {
    isLocked(challenge)
      || challenge.canMove
      || waitLine(challenge) != nil
      || [.ready, .started].contains(challenge.status)
      || ([.done, .tried].contains(challenge.status) && challenge.blockId != nil)
  }

  /// A call that has its block opens on the call's own intro, as main's challenge page does.
  private func callBlockId(_ challenge: Components.Schemas.Challenge) -> String? {
    guard challenge.call != nil, challenge.status != .done, !challenge.locked else {
      return nil
    }

    return challenge.blockId
  }

  private func isCheckpoint(_ challenge: Components.Schemas.Challenge) -> Bool {
    challenge.kind != .weekly && !challenge.mock
  }

  private func isTrickster(_ challenge: Components.Schemas.Challenge) -> Bool {
    isCheckpoint(challenge) && challenge.call == nil
  }

  /// A mock always says when it is; a weekly challenge only once it has a start time, as on main.
  private func when(_ challenge: Components.Schemas.Challenge) -> String? {
    guard let date = challenge.date, challenge.mock || challenge.startTime != nil else {
      return nil
    }

    return [dayLabel(date, today: challenge.today), challenge.startTime.flatMap(clockTime)]
      .compactMap(\.self)
      .joinedFacts()
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
          comment:
            "Title of a language goal's challenge, a speaking practice call, before it's written.")
    }

    if isTrickster(challenge) {
      return challenge.status == .done
        ? LocalizedStringResource(
          "You beat the Trickster!", table: "Practice", comment: "A won phase challenge.")
        : LocalizedStringResource(
          "Beat the Trickster", table: "Practice", comment: "Title of a Trickster duel's intro.")
    }

    switch challenge.kind {
    case .weekly:
      return LocalizedStringResource(
        "Weekly challenge", table: "Practice", comment: "Title of the weekly challenge block.")
    case .finalBoss, .boss:
      return LocalizedStringResource(
        "Mock exam", table: "Practice", comment: "Title of a mock exam challenge.")
    }
  }

  private func description(_ challenge: Components.Schemas.Challenge) -> String {
    if challenge.call != nil {
      return String(
        localized: "A live call where you get your point across. Speak or type.", table: "Practice",
        comment: "What a challenge call is.")
    }

    if challenge.mock {
      return String(
        localized: "Your result only shows at the end, like on exam day.", table: "Practice",
        comment: "What a mock exam challenge is.")
    }

    if challenge.kind == .weekly {
      return String(
        localized: "Questions on what you studied this week.", table: "Practice",
        comment: "What the weekly challenge asks.")
    }

    let count = challenge.questions.flatMap { $0 > 0 ? $0 : nil }
    let passMark = challenge.passMark.flatMap { $0 > 0 ? $0 : nil }

    if (challenge.recordings ?? 0) > 0 {
      guard let count, let passMark else {
        return String(
          localized: "Questions on recordings, played as in the exam.", table: "Practice",
          comment: "What a listening Trickster duel asks, before its count is known.")
      }

      return String(
        localized:
          "\(count) questions on recordings, played as in the exam. Get \(passMark) right to win.",
        table: "Practice",
        comment: "What a listening Trickster duel asks; then how many right answers win it")
    }

    guard let count, let passMark else {
      return String(
        localized: "Questions on what you just learned.", table: "Practice",
        comment: "What a Trickster duel asks, before its count is known.")
    }

    return String(
      localized: "\(count) questions on what you just learned. Get \(passMark) right to win.",
      table: "Practice", comment: "What a Trickster duel asks; then how many right answers win it")
  }

  /// Main's `TaskMeta`: the facts in mono, then the Brain Power a win brings in its color.
  private func meta(_ challenge: Components.Schemas.Challenge) -> AttributedString? {
    let facts = facts(challenge)
    let reward =
      challenge.reward.brainPower > 0 && !challenge.mock
      ? String(
        localized: "+\(challenge.reward.brainPower) Brain Power", table: "Practice",
        comment: "A challenge's Brain Power reward.")
      : nil

    guard !facts.isEmpty || reward != nil else {
      return nil
    }

    var line = AttributedString(facts.joinedFacts())

    if let reward {
      var earned = AttributedString(reward)
      earned.foregroundColor = .brainText
      line += facts.isEmpty ? earned : AttributedString("\u{00A0}· ") + earned
    }

    return line
  }

  /// A weekly challenge's or a mock's day leads; a Trickster duel says its count in its sentence.
  private func facts(_ challenge: Components.Schemas.Challenge) -> [String] {
    var facts: [String] = []

    if let when = when(challenge) {
      facts.append(when)
    }

    if isTrickster(challenge) {
      return facts
    }

    if let questions = challenge.questions, questions > 0 {
      facts.append(
        String(
          localized: "\(questions) questions", table: "Practice",
          comment: "How many questions a test asks."))
    }

    // Main says how long only a mock or a call takes; a duel's length is its questions.
    if challenge.mock || challenge.call != nil,
      let minutes = challenge.estimatedMinutes ?? challenge.minutes
    {
      facts.append(studyDuration(minutes: minutes))
    }

    if let date = challenge.date, challenge.status == .upcoming, when(challenge) == nil {
      facts.append(dayLabel(date, today: challenge.today))
    }

    return facts
  }

  /// The gate's words, shown once the learner opened the challenge (lane E's 13.1 and 13.2).
  @ViewBuilder
  private func gateWords(_ challenge: Components.Schemas.Challenge) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      if challenge.mock {
        Text("Mock exams need a subscription", tableName: "Practice", comment: "A mock exam's gate")
          .typeStyle(.body.weight(.semibold))
      } else if challenge.call != nil {
        Text(
          "This call needs a subscription", tableName: "Practice",
          comment: "A challenge call's gate"
        )
        .typeStyle(.body.weight(.semibold))
        Text(
          "Your plan goes on without it.", tableName: "Practice", comment: "A challenge call's gate"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      } else {
        Text(
          "You've used your free lessons", tableName: "Practice",
          comment: "A Trickster duel's gate once the free plan's lessons are used"
        )
        .typeStyle(.body.weight(.semibold))
        Text(
          "You can still review and practice your mistakes, or subscribe to keep going.",
          tableName: "Practice",
          comment: "A Trickster duel's gate once the free plan's lessons are used"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
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
      load = .loaded(challenge)
    } catch let error as APIError {
      if error == .unauthorized {
        await session.expire(identity)
      } else if session.authenticatedSession != identity {
        return
      }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }

  /// A learner who left (the screen closed, signed out) gets nothing opened or started behind them.
  private func start(afterWriting: Bool) async {
    isStarting = true
    startProblem = nil
    writeLimit = nil
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
    case .refused(.limit(let limit)):
      writeLimit = limit
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
      self.moved = moved.changeId.map {
        Moved(changeId: $0, effect: moved.effect.flatMap { try? PracticeJSON.recode($0) })
      }
      await read()

      if let moved = self.moved, case .loaded(let challenge) = load, let date = challenge.date {
        announcePolitely([movedTo(date), movedDetail(moved.effect)].joinedSentences())
      }
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
      moved = nil
      await read()
    case .refused, .failed:
      moveProblem = Self.notDone
    case .obsolete:
      break
    }
  }

  private func movedDetail(_ effect: PlanEffect?) -> String {
    let leftOut = effect.flatMap {
      $0.lessonsRemoved > 0
        ? PlanChangeEffect.consequence($0, today: PlanDate.isoDate(.now))?.text : nil
    }

    return [
      String(
        localized: "Your plan moved later lessons to make room for it.", table: "Practice",
        comment: "After moving a weekly challenge to another day"),
      leftOut,
    ]
    .compactMap(\.self)
    .joinedSentences()
  }

  /// Past this, a start still running says so (main's `START_BOUNDS.slowMs`).
  private static let slowStart = Duration.seconds(10)

  private static var slowStartLine: String {
    String(
      localized: "Still starting. This is taking longer than usual.", table: "Practice",
      comment: "Starting a challenge is taking longer than usual.")
  }

  private static let notDone = LocalizedStringResource(
    "That didn't go through. Try again in a moment.", table: "Practice",
    comment: "A challenge's start or move failed.")
}

/// Main's `ChallengeTopics`: a row per area with its topics and how many, or a topic on its own
/// where it has no area.
private struct ChallengeTopicRows: View {
  struct Row: Identifiable {
    let title: String
    let topics: [String]
    let isArea: Bool

    var id: String { "\(isArea):\(title)" }
  }

  let rows: [Row]

  init(topics: [(name: String, area: String?)]) {
    var areas: [String] = []
    var grouped: [String: [String]] = [:]
    var rows: [Row] = []

    for topic in topics {
      guard let area = topic.area else {
        if !rows.contains(where: { !$0.isArea && $0.title == topic.name }) {
          rows.append(Row(title: topic.name, topics: [topic.name], isArea: false))
        }

        continue
      }

      if grouped[area] == nil {
        areas.append(area)
      }

      if grouped[area, default: []].contains(topic.name) == false {
        grouped[area, default: []].append(topic.name)
      }
    }

    self.rows = areas.map { Row(title: $0, topics: grouped[$0] ?? [], isArea: true) } + rows
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      ForEach(rows) { row in
        if row.id != rows.first?.id {
          Rectangle()
            .fill(.border)
            .frame(height: 1)
        }

        ListRow(
          Text(row.title),
          description: row.isArea
            ? Text(row.topics.formatted(.list(type: .and, width: .narrow))) : nil
        ) {
          EmptyView()
        } trailing: {
          if row.isArea {
            Text(
              "\(row.topics.count) topics", tableName: "Practice",
              comment: "How many topics of an area a challenge asks about, at the end of its row")
          }
        }
        .lineLimit(2)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      }
    }
  }
}
