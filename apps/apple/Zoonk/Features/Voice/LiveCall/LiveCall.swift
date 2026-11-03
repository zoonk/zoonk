import AVFoundation
import Foundation
import Observation

struct LiveCallClient {
  /// Reserves the call; `takeover` ends the learner's other open call first.
  let connect: @MainActor (_ takeover: Bool) async -> CallReservation
  /// `turns`: the call so far, which the character carries on from when the connection continues it.
  let redeem:
    @MainActor (_ connectionId: String, _ offer: String, _ turns: [ConversationTurn]) async throws
      -> String
  /// Has the server hang up: whether it already had at the call's deadline, nil if unconfirmed.
  let end: @MainActor (_ connectionId: String) async -> Bool?
  /// Nil when the check didn't run.
  let checkObjectives: @MainActor ([ConversationTurn]) async -> ObjectiveCheck?
  let makeTransport: @MainActor () -> any LiveCallTransport
  /// Asks for the microphone; false when the learner said no.
  let requestMicrophone: @MainActor () async -> Bool
}

/// What "Call again" hands the next connection on the same screen: the call so far.
/// `connectionId` is what completion must name, the latest connection the screen saw, once one went
/// live: until then there's no call to save.
struct CallSoFar {
  var turns: [TranscriptTurn] = []
  var metLabels: [String]
  var usedHelp = false
  var examCuesSent = 0
  var connectionId: String?

  static func newCall(_ conversation: LanguageConversation) -> Self {
    .init(metLabels: conversation.objectives.filter(\.met).map(\.label))
  }
}

/// Mirrors main's `useLiveCall`. The microphone is asked for before anything is reserved, so a
/// learner who says no can choose to type instead. Ending a call silences it at once; the server
/// then hangs it up and confirms before the peer goes and before anything is saved.
@MainActor
@Observable
final class LiveCall {
  enum Phase: Equatable {
    case idle
    case connecting
    case live
    case ended
    case failed
  }

  enum Failure: Equatable {
    case callInProgress
    case callsPaused
    case connect
    case dropped
    case ended
    case limit
    case plusRequired
  }

  enum Turn: Equatable {
    case calling, reconnecting, goodbye, characterTalking, muted, typing, listening, yourTurn
  }

  /// What the turn row and the wrap-up line show, as the call's clock runs.
  struct Signals: Equatable {
    var isCharacterTalking = false
    var isLearnerSpeaking = false
    var isQuietLong = false
    var isSayingGoodbye = false
    var wrapUp: LiveCallEnding.Reason?
  }

  /// A session that hasn't started after this isn't going to.
  static let connectTimeout = Duration.seconds(15)
  /// How often the microphone is read and the ending rules run.
  static let tick = Duration.milliseconds(200)

  private(set) var phase = Phase.idle
  private(set) var failure: Failure?
  private(set) var limit: CallLimit?
  private(set) var metLabels: [String] = []
  private(set) var muted = false
  /// The learner said no to the microphone, or chose to type.
  private(set) var micBlocked = false
  private(set) var reconnecting = false
  private(set) var liveSince: Date?
  private var endedAt: Date?
  /// A new call's clock starts when it goes live; a continued one's goes on from the talk time its
  /// earlier connections used.
  private var clockStart: Date?
  private(set) var signals = Signals()
  /// Earlier connections' turns: this connection's fragments never join them.
  private var earlierTurns: [TranscriptTurn] = []
  private var connectionTurns: [TranscriptTurn] = []
  /// Earlier connections' help goes with them when the setup opens a new call; help used while
  /// this one rang stays.
  private var helpedEarlier = false
  private var helped = false
  /// The dropped call's connection this one continues, which completion names if it never goes
  /// live: nil for a new call.
  private var droppedConnectionId: String?

  @ObservationIgnored private let conversation: LanguageConversation
  @ObservationIgnored private let client: LiveCallClient
  @ObservationIgnored private var transport: (any LiveCallTransport)?
  @ObservationIgnored private var connectionId: String?
  /// This connection's talk time, after which the character says goodbye.
  @ObservationIgnored private var talkSeconds: Int
  @ObservationIgnored private var attempt = 0
  /// The learner chose to end their call that's open elsewhere.
  @ObservationIgnored private var takesOver = false
  @ObservationIgnored private var closeConfirmed = false
  @ObservationIgnored private var endedAtDeadline = false
  @ObservationIgnored private var closing: Task<Bool, Never>?
  @ObservationIgnored private var script: LiveCallScript?
  @ObservationIgnored private var talkEndsAt: Date?
  @ObservationIgnored private var hardStopAt: Date?
  @ObservationIgnored private var ending: LiveCallEnding?
  @ObservationIgnored private(set) var replyGaps = LiveCallReplyGaps()
  @ObservationIgnored private var delegations = 0
  @ObservationIgnored private var tracked = false
  @ObservationIgnored private var waitingReplies: [String] = []
  @ObservationIgnored private var timers: [Task<Void, Never>] = []
  @ObservationIgnored private var settle: Task<Void, Never>?
  @ObservationIgnored private var openingCues = 0
  @ObservationIgnored private var goodbyeCues = 0
  @ObservationIgnored private var examCuesSent = 0
  @ObservationIgnored private var checkTiming = ObjectiveCheckTiming()
  /// Its own task, so words that arrive while it runs don't cancel it and lose its answer.
  @ObservationIgnored private var runningCheck: Task<Void, Never>?
  @ObservationIgnored private var reserving: Task<CallReservation?, Never>?

  init(conversation: LanguageConversation, client: LiveCallClient, soFar: CallSoFar? = nil) {
    self.conversation = conversation
    self.client = client
    talkSeconds = conversation.minutes * 60
    carry(soFar ?? .newCall(conversation))
  }

  var turns: [TranscriptTurn] {
    earlierTurns + connectionTurns
  }

  var usedHelp: Bool {
    helpedEarlier || helped
  }

  /// There's a dropped call to save, whatever happens to this reconnect.
  var continuing: Bool {
    droppedConnectionId != nil
  }

  /// A reconnect's own reservation is the latest connection even if it never goes live.
  var soFar: CallSoFar {
    .init(
      turns: turns, metLabels: metLabels, usedHelp: usedHelp, examCuesSent: examCuesSent,
      connectionId: liveSince != nil || continuing ? connectionId ?? droppedConnectionId : nil)
  }

  var dropped: DroppedCall? {
    DroppedCall(continuing: continuing, phase: phase, failure: failure, micBlocked: micBlocked)
  }

  /// The whole call's talk time, whichever connection this is.
  var callSeconds: Int {
    conversation.minutes * 60
  }

  func elapsed(at date: Date) -> TimeInterval {
    guard let clockStart else {
      return 0
    }

    return max(0, (endedAt ?? date).timeIntervalSince(clockStart))
  }

  /// On this connection: earlier connections' words don't count.
  private var hasCharacterSpoken: Bool {
    connectionTurns.contains { $0.speaker == .character }
  }

  /// The learner has said something out loud: until then the turn row tells them to.
  var hasLearnerSpoken: Bool {
    turns.contains { $0.speaker == .learner && $0.startMs != nil }
  }

  /// Whose turn the row shows, the first that applies. Until the character's first words the call
  /// still reads as calling: the intro said the character answers first.
  var turn: Turn {
    if reconnecting {
      return .reconnecting
    }

    if phase != .live || !hasCharacterSpoken {
      return .calling
    }

    if signals.isSayingGoodbye, !signals.isLearnerSpeaking {
      return .goodbye
    }

    if signals.isCharacterTalking {
      return .characterTalking
    }

    if muted {
      return .muted
    }

    if micBlocked {
      return .typing
    }

    return signals.isLearnerSpeaking ? .listening : .yourTurn
  }

  /// Leaving the screen or starting again cancels a start still on its way. A learner who said no
  /// to the microphone stays on the intro, with nothing reserved; choosing to type then still ends
  /// the other call they chose to end.
  func start(takeover: Bool = false) async {
    attempt += 1
    let mine = attempt
    failure = nil
    takesOver = takesOver || takeover

    if !micBlocked {
      let granted = await client.requestMicrophone()

      guard attempt == mine else {
        return
      }

      guard granted else {
        micBlocked = true
        return
      }
    }

    phase = .connecting

    let takeover = takesOver
    let reserving = Task { await reserve(takeover: takeover, isCurrent: { self.attempt == mine }) }
    self.reserving = reserving
    let reservation = await reserving.value

    guard attempt == mine, let reservation else {
      return
    }

    guard case .ready(let setup) = reservation else {
      fail(failure(for: reservation), limit: reservation.callLimit)
      return
    }

    // The times the server said were left, from now: the device's clock can be off.
    let now = Date.now

    if setup.continuesCall {
      clockStart = now.addingTimeInterval(-TimeInterval(callSeconds - setup.talkSeconds))
    } else {
      // The server keeps the goals already met.
      carry(.init(metLabels: metLabels))
    }

    talkSeconds = setup.talkSeconds
    talkEndsAt = now.addingTimeInterval(TimeInterval(setup.talkSeconds))
    hardStopAt = now.addingTimeInterval(TimeInterval(setup.seconds))
    script = setup.script

    let transport = client.makeTransport()
    self.transport = transport
    transport.onEvent = { [weak self] event in self?.handle(event, run: mine) }
    transport.onLost = { [weak self] in self?.lost(run: mine) }

    timers.append(
      Task { [weak self] in
        try? await Task.sleep(for: Self.connectTimeout)

        guard let self, !Task.isCancelled, self.attempt == mine, self.phase == .connecting else {
          return
        }

        self.fail(.connect)
      })

    do {
      let offer = try await transport.makeOffer()
      guard attempt == mine else { return }
      let answer = try await client.redeem(
        setup.connectionId, offer, earlierTurns.conversationTurns)
      guard attempt == mine else { return }
      try await transport.accept(answer: answer)
    } catch {
      if attempt == mine, phase == .connecting {
        fail(.connect)
      }
    }
  }

  /// The learner chose to do the call by typing.
  func startTyping() async {
    micBlocked = true
    await start()
  }

  /// The learner hung up: at once, with no goodbye, as a phone does.
  func hangUp() {
    end(.learnerEnded)
  }

  /// The learner cancelled while calling: the reservation goes, and nothing is saved.
  func cancel() {
    guard phase == .connecting else {
      return
    }

    track(.learnerEnded)
    leave()
  }

  /// A call still going shows as dropped, and the server hangs it up.
  func leave() {
    attempt += 1

    switch phase {
    case .connecting:
      fail(.connect)
    case .live:
      fail(.dropped)
    default:
      Task { _ = await release() }
    }
  }

  /// While the call connects, a typed reply waits.
  func sendText(_ text: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !trimmed.isEmpty, phase == .connecting || phase == .live else {
      return
    }

    connectionTurns = connectionTurns.addingTypedReply(trimmed)
    heard(.learner, startMs: nil)

    guard phase == .live, let script else {
      waitingReplies.append(trimmed)
      return
    }

    send(script.cues.typedReply.quoting(trimmed))
    ending?.learnerSent(at: .now)
    advance()
  }

  /// A key typed in the reply field: the learner is answering.
  func typing() {
    guard phase == .live else {
      return
    }

    ending?.learnerTyped(at: .now)
    advance()
  }

  func useHelp() {
    helped = true
  }

  func toggleMute() {
    guard phase == .live, !micBlocked else {
      return
    }

    muted.toggle()
    transport?.send(.mute(muted))
  }

  /// Once a reservation still on its way has answered, so its connection is known.
  func settled() async {
    _ = await reserving?.value
  }

  /// Returns what it saves whether or not the hangup went through: completing hangs it up too before
  /// anything is reviewed. Nil when no connection went live, as there's no call to save.
  func finish() async -> Components.Schemas.LanguageConversationCompletionInput? {
    await settled()

    guard let connectionId = soFar.connectionId else {
      return nil
    }

    _ = await release()

    return .init(
      connectionId: connectionId,
      spokenSeconds: min(turns.spokenSeconds, 1260),
      timeZone: TimeZone.current.identifier,
      turns: turns.conversationTurns,
      usedHelp: usedHelp)
  }

  /// True once the server confirmed the hangup. The connection's ID stays, so asking again after a
  /// failure sends a new request, and nothing is saved until the server confirms.
  func release() async -> Bool {
    silence()
    closeTransport()

    guard let connectionId, !closeConfirmed else {
      return true
    }

    if let closing {
      return await closing.value
    }

    let task = Task { [client] in
      let atDeadline = await client.end(connectionId)

      if let atDeadline {
        self.closeConfirmed = true
        self.endedAtDeadline = atDeadline
      }

      self.closing = nil
      return atDeadline != nil
    }

    closing = task
    return await task.value
  }

  private func reserve(takeover: Bool, isCurrent: () -> Bool) async -> CallReservation? {
    let first = await client.connect(takeover)
    var answer = first

    // This call's last connection is still closing: ask once more.
    if first == .previousConnectionClosing, isCurrent() {
      reconnecting = true
      answer = await client.connect(takeover)
    }

    guard case .ready(let setup) = answer else {
      return answer
    }

    // Kept even when the start was cancelled meanwhile: completion must name the latest connection.
    connectionId = setup.connectionId
    closeConfirmed = false
    endedAtDeadline = false

    // A start cancelled meanwhile never connects: its reservation is ended at once.
    guard isCurrent() else {
      Task { _ = await release() }
      return nil
    }

    return answer
  }

  private func failure(for reservation: CallReservation) -> Failure {
    switch reservation {
    case .callInProgress: .callInProgress
    case .callsPaused: .callsPaused
    case .ended: .ended
    case .limit: .limit
    case .plusRequired: .plusRequired
    case .ready, .failed, .previousConnectionClosing: .connect
    }
  }

  private func handle(_ event: LiveServerEvent, run: Int) {
    guard run == attempt else {
      return
    }

    // Before the call is live, only its start, or the server closing it early, means anything.
    if phase == .connecting {
      switch event {
      case .started:
        goLive()
      case .closed:
        fail(.connect)
      default:
        break
      }

      return
    }

    guard phase == .live, let script else {
      return
    }

    let now = Date.now

    switch event {
    case .started:
      break
    case .closed:
      end(.hardStop)
    case .transcript(let speaker, let delta, let startMs, let endMs):
      connectionTurns = connectionTurns.adding(
        delta, speaker: speaker, startMs: startMs, endMs: endMs)

      if speaker == .learner {
        ending?.learnerHeard(at: now)
      } else {
        ending?.characterSpoke(at: now, startMs: startMs)
        replyGaps.characterSpoke(at: now)
      }

      heard(speaker, startMs: startMs)
    case .delegation(let id):
      delegations += 1
      send(script.cues.noBackend, delegationId: id)
    case .acknowledged(let id, let startMs):
      if id.hasPrefix(Self.openingEventPrefix) {
        ending?.openingAcknowledged(at: now)
      } else if id.hasPrefix(Self.goodbyeEventPrefix) {
        ending?.goodbyeAcknowledged(startMs: startMs)
      }
    }

    advance(now)
  }

  private func goLive() {
    guard let script, let talkEndsAt, let hardStopAt else {
      return
    }

    let now = Date.now
    liveSince = now
    clockStart = clockStart ?? now
    phase = .live
    reconnecting = false
    ending = LiveCallEnding(
      timing: script.timing, liveAt: now, talkEndsAt: talkEndsAt, hardStopAt: hardStopAt)
    sendOpening(script.cues.opening)

    for reply in waitingReplies {
      send(script.cues.typedReply.quoting(reply))
      ending?.learnerSent(at: now)
    }

    waitingReplies = []
    startClock()
  }

  private func startClock() {
    timers.append(
      Task { [weak self] in
        while !Task.isCancelled {
          try? await Task.sleep(for: Self.tick)

          guard let self, self.phase == .live else {
            return
          }

          await self.listen()
          self.sendExamCues()
          self.advance()
        }
      })
  }

  /// Muted or typing, the microphone never counts as speech.
  private func listen() async {
    guard let transport, !muted, !micBlocked, await transport.hearsSpeech(),
      phase == .live, !muted
    else {
      return
    }

    let now = Date.now
    ending?.learnerSpoke(at: now)
    replyGaps.learnerSpoke(at: now)
  }

  /// An exam's own prompts, at their times on the call's clock, until the ending starts or the
  /// connection is lost: a cue a drop held back goes out after "Call again", once the character's
  /// first words there (its resume line) did.
  private func sendExamCues() {
    guard let cues = conversation.speakingTask?.cues, let ending, ending.armed == nil,
      hasCharacterSpoken,
      let due = Self.examCueDue(
        at: elapsed(at: .now), times: cues.map(\.atSeconds), sent: examCuesSent)
    else {
      return
    }

    send(LiveCallCue(channel: .instructions, text: cues[due].say))
    examCuesSent = due + 1
  }

  /// Only the latest cue that came due: ones a drop held back are stale once the call resumes.
  static func examCueDue(at elapsed: TimeInterval, times: [Int], sent: Int) -> Int? {
    times.indices.last { $0 >= sent && elapsed >= TimeInterval(times[$0]) }
  }

  private func advance(_ now: Date = .now) {
    guard phase == .live, let script else {
      return
    }

    for action in ending?.advance(to: now) ?? [] {
      switch action {
      case .send(.opening, _):
        sendOpening(script.cues.opening)
      case .send(.checkIn, _):
        send(script.cues.checkIn)
      case .send(.goodbye, let whileLearnerSpeaks):
        sendGoodbye(script.cues.goodbye, whileLearnerSpeaks: whileLearnerSpeaks)
      case .send(.goodbyeDone, let whileLearnerSpeaks):
        sendGoodbye(script.cues.goodbyeDone, whileLearnerSpeaks: whileLearnerSpeaks)
      case .hangUp(let reason):
        end(reason.map { EndReason($0) } ?? .hardStop)
        return
      }
    }

    guard let ending else {
      return
    }

    let next = Signals(
      isCharacterTalking: ending.isCharacterSpeaking(at: now),
      isLearnerSpeaking: ending.isLearnerSpeaking(at: now),
      isQuietLong: ending.isQuietLong(at: now),
      isSayingGoodbye: ending.isGoodbyeSaid,
      wrapUp: ending.armed)

    if next != signals {
      signals = next
    }
  }

  private static let openingEventPrefix = "opening-"
  private static let goodbyeEventPrefix = "goodbye-"

  /// Its acknowledgment says GPT-Live took it in, so a slow start isn't greeted twice.
  private func sendOpening(_ cue: LiveCallCue) {
    openingCues += 1
    send(cue, eventId: "\(Self.openingEventPrefix)\(openingCues)")
  }

  /// Its acknowledgment says where on the session's timeline the goodbye starts.
  private func sendGoodbye(_ cue: LiveCallCue, whileLearnerSpeaks: Bool) {
    goodbyeCues += 1
    let channel = whileLearnerSpeaks ? .thinking : cue.channel
    send(
      LiveCallCue(channel: channel, text: cue.text),
      eventId: "\(Self.goodbyeEventPrefix)\(goodbyeCues)")
  }

  /// The character's next words answer the cue, on any channel, not only the learner: they aren't
  /// a reply gap. A delegation's answer only lets the character go on answering.
  private func send(_ cue: LiveCallCue, delegationId: String? = nil, eventId: String? = nil) {
    transport?.send(.append(cue, delegationId: delegationId, eventId: eventId))

    if delegationId == nil {
      replyGaps.cueSent()
    }
  }

  /// Every transcript fragment waits for the transcript to settle again. An exam task's one goal
  /// is the task itself, graded when the call ends.
  private func heard(_ speaker: ConversationSpeaker, startMs: Double?) {
    guard conversation.speakingTask == nil else {
      return
    }

    checkTiming.hear(speaker, startMs: startMs)
    checkOnceSettled()
  }

  /// A check still running holds the next until it's done.
  private func checkOnceSettled() {
    settle?.cancel()
    settle = Task { [weak self] in
      try? await Task.sleep(for: ObjectiveCheckTiming.settle)

      guard !Task.isCancelled, let self else {
        return
      }

      if self.runningCheck != nil {
        self.checkOnceSettled()
      } else if self.phase == .live, self.checkTiming.isDue {
        self.runningCheck = Task { [weak self] in
          await self?.checkObjectives()
          self?.runningCheck = nil
        }
      }
    }
  }

  private func checkObjectives() async {
    let sentAt = Date.now
    checkTiming.read()
    let found = await client.checkObjectives(turns.conversationTurns)

    guard phase == .live, let check = found else {
      return
    }

    if check.objectivesMet.count > metLabels.count {
      metLabels = check.objectivesMet
    }

    let now = Date.now
    let allGoalsMet = conversation.objectives.allSatisfy {
      check.objectivesMet.contains($0.label)
    }
    let sendsProgress = ending?.checked(
      at: now, snapshotAt: sentAt, goodbye: check.goodbye, allGoalsMet: allGoalsMet)

    if sendsProgress == true, let progress = check.progress?.value1 {
      send(progress)
    }

    advance(now)
  }

  /// The connection went away without GPT-Live saying the session closed: our server hanging it up
  /// at its deadline closes the channel that way, and that call ended normally; anything else
  /// lost it.
  private func lost(run: Int) {
    guard run == attempt, phase == .connecting || phase == .live else {
      return
    }

    let wasLive = phase == .live
    // Nothing a pending objective check answers can end it normally anymore.
    ending = nil

    Task {
      let closed = await release()

      guard run == attempt, phase == .connecting || phase == .live else {
        return
      }

      if closed && endedAtDeadline {
        end(.hardStop)
      } else {
        fail(wasLive ? .dropped : .connect)
      }
    }
  }

  private func end(_ reason: EndReason) {
    guard phase == .connecting || phase == .live else {
      return
    }

    silence()
    endedAt = .now
    phase = .ended
    track(reason)
  }

  private func fail(_ failure: Failure, limit: CallLimit? = nil) {
    self.failure = failure
    self.limit = limit
    phase = .failed
    reconnecting = false
    track(failure == .dropped ? .dropped : .failed)
    Task { _ = await release() }
  }

  /// Once per reserved connection, however it ended.
  private func track(_ reason: EndReason) {
    guard connectionId != nil, !tracked else {
      return
    }

    tracked = true
    replyGaps.callEnded()

    UsageAnalytics.track(
      .callEnded(
        .init(
          conversationKind: conversation.kind, delegations: delegations,
          durationSeconds: liveSince.map { Int(Date.now.timeIntervalSince($0).rounded()) } ?? 0,
          learnerTurns: connectionTurns.filter { $0.speaker == .learner }.count, reason: reason,
          replyGapMaxMs: replyGaps.maxMs, replyGapMedianMs: replyGaps.medianMs,
          slowReplies: replyGaps.slowReplies, talkSeconds: talkSeconds,
          unansweredTurns: replyGaps.unansweredTurns)))
  }

  private func silence() {
    for timer in timers {
      timer.cancel()
    }

    timers = []
    settle?.cancel()
    runningCheck?.cancel()
    // The bar stays full once the ending started.
    signals = Signals(wrapUp: signals.wrapUp)
    transport?.silence()
  }

  private func carry(_ soFar: CallSoFar) {
    earlierTurns = soFar.turns
    metLabels = soFar.metLabels
    helpedEarlier = soFar.usedHelp
    examCuesSent = soFar.examCuesSent
    droppedConnectionId = soFar.connectionId
  }

  private func closeTransport() {
    transport?.close()
    transport = nil
  }
}

extension LiveCall {
  /// How a call ended, as the call-ended event reports it.
  enum EndReason: String {
    case time, done, goodbye, quiet, dropped, failed
    case learnerEnded = "learner_ended"
    case hardStop = "hard_stop"

    init(_ reason: LiveCallEnding.Reason) {
      switch reason {
      case .time: self = .time
      case .done: self = .done
      case .goodbye: self = .goodbye
      case .quiet: self = .quiet
      }
    }
  }
}

extension CallReservation {
  fileprivate var callLimit: CallLimit? {
    if case .limit(let limit) = self {
      return limit
    }

    return nil
  }
}

extension LiveCallClient {
  /// Every request runs under the session that started the call.
  @MainActor
  static func live(conversationId: String, voice: VoiceServices, api: LiveCallAPI) -> LiveCallClient
  {
    let owner = CallOwner()

    return LiveCallClient(
      connect: { takeover in
        // The call holds the plan's call time from its reservation.
        let reservation = await voice.cache.mutate(invalidating: [.allowance]) { identity in
          owner.identity = identity
          return try await api.connect(
            conversationId: conversationId, takeover: takeover, token: identity.bearerToken)
        }

        guard case .done(let answer) = reservation else {
          return .failed
        }

        return answer
      },
      redeem: { connectionId, offer, turns in
        let answer = await voice.cache.mutate { identity in
          try await api.redeemSdp(
            conversationId: conversationId, connectionId: connectionId, offer: offer, turns: turns,
            token: identity.bearerToken)
        }

        guard case .done(let sdp) = answer else {
          throw APIError.unavailable
        }

        return sdp
      },
      end: { connectionId in
        // Hanging up is cleanup: it goes out under the learner who reserved the call, even if the
        // session changed since, so the server stops the call's time.
        guard let identity = owner.identity else {
          return nil
        }

        let ended = try? await api.end(
          conversationId: conversationId, connectionId: connectionId, token: identity.bearerToken)

        if ended != nil {
          voice.cache.invalidate([.allowance])
        }

        return ended ?? nil
      },
      checkObjectives: { turns in
        let check = await voice.cache.mutate { identity in
          try await api.checkObjectives(
            conversationId: conversationId, turns: turns, token: identity.bearerToken)
        }

        guard case .done(let found) = check else {
          return nil
        }

        return found
      },
      makeTransport: { WebRTCLiveCallTransport() },
      requestMicrophone: { await AVAudioApplication.requestRecordPermission() })
  }
}

@MainActor
private final class CallOwner {
  var identity: AuthenticatedSession?
}
