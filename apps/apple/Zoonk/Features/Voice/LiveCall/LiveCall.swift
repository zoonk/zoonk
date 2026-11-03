import AVFoundation
import Foundation
import Observation

struct LiveCallClient {
  /// Reserves the call; `takeover` ends the learner's other open call first.
  let connect: @MainActor (_ takeover: Bool) async -> CallReservation
  let redeem: @MainActor (_ connectionId: String, _ offer: String) async throws -> String
  /// Has the server hang up: whether it already had at the call's deadline, nil if unconfirmed.
  let end: @MainActor (_ connectionId: String) async -> Bool?
  /// Nil when the check didn't run.
  let checkObjectives: @MainActor ([ConversationTurn]) async -> ObjectiveCheck?
  let makeTransport: @MainActor () -> any LiveCallTransport
  /// Asks for the microphone; false when the learner said no.
  let requestMicrophone: @MainActor () async -> Bool
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

  /// What the turn row and the wrap-up line show, as the call's clock runs.
  struct Signals: Equatable {
    var isCharacterTalking = false
    var isLearnerSpeaking = false
    var isQuietLong = false
    var isSayingGoodbye = false
    var wrapUp: LiveCallEnding.Reason?
  }

  typealias EndsAtLimit = Components.Schemas.LanguageConversationSetup.EndsAtLimitPayload

  /// A session that hasn't started after this isn't going to.
  static let connectTimeout = Duration.seconds(15)
  /// The character's answer has settled once its transcript stays quiet this long.
  static let replySettled = Duration.milliseconds(1500)
  /// How often the microphone is read and the ending rules run.
  static let tick = Duration.milliseconds(200)

  private(set) var phase = Phase.idle
  private(set) var failure: Failure?
  private(set) var limit: CallLimit?
  private(set) var turns: [TranscriptTurn] = []
  private(set) var metLabels: [String]
  private(set) var muted = false
  /// The learner said no to the microphone, or chose to type.
  private(set) var micBlocked = false
  private(set) var reconnecting = false
  private(set) var liveSince: Date?
  private(set) var endedAt: Date?
  /// The call's talk time, after which the character says goodbye.
  private(set) var talkSeconds: Int
  /// The plan's call time runs out with this call: today's or this month's.
  private(set) var endsAtLimit: EndsAtLimit?
  private(set) var signals = Signals()

  @ObservationIgnored private let conversation: LanguageConversation
  @ObservationIgnored private let client: LiveCallClient
  @ObservationIgnored private var transport: (any LiveCallTransport)?
  @ObservationIgnored private var connectionId: String?
  @ObservationIgnored private var attempt = 0
  @ObservationIgnored private var closeConfirmed = false
  @ObservationIgnored private var endedAtDeadline = false
  @ObservationIgnored private var closing: Task<Bool, Never>?
  @ObservationIgnored private var script: LiveCallScript?
  @ObservationIgnored private var talkEndsAt: Date?
  @ObservationIgnored private var hardStopAt: Date?
  @ObservationIgnored private var ending: LiveCallEnding?
  @ObservationIgnored private var replyGaps = LiveCallReplyGaps()
  @ObservationIgnored private var delegations = 0
  @ObservationIgnored private var tracked = false
  @ObservationIgnored private var waitingReplies: [String] = []
  @ObservationIgnored private var timers: [Task<Void, Never>] = []
  @ObservationIgnored private var settle: Task<Void, Never>?
  @ObservationIgnored private var openingCues = 0
  @ObservationIgnored private var goodbyeCues = 0
  @ObservationIgnored private var examCuesSent = 0
  @ObservationIgnored private var learnerSpokeSinceCheck = false
  @ObservationIgnored private var checking = false
  @ObservationIgnored private var checkAgain = false

  init(conversation: LanguageConversation, client: LiveCallClient) {
    self.conversation = conversation
    self.client = client
    metLabels = conversation.objectives.filter(\.met).map(\.label)
    talkSeconds = conversation.minutes * 60
  }

  /// The learner has said something out loud: until then the turn row tells them to.
  var hasLearnerSpoken: Bool {
    turns.contains { $0.speaker == .learner && $0.startMs != nil }
  }

  /// Leaving the screen or starting again cancels a start still on its way. A learner who said no
  /// to the microphone stays on the intro, with nothing reserved.
  func start(takeover: Bool = false) async {
    attempt += 1
    let mine = attempt
    failure = nil

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

    let reservation = await reserve(takeover: takeover, isCurrent: { self.attempt == mine })

    guard attempt == mine, let reservation else {
      return
    }

    guard case .ready(let setup) = reservation else {
      fail(failure(for: reservation), limit: reservation.callLimit)
      return
    }

    // The times the server said were left, from now: the device's clock can be off.
    let now = Date.now
    talkSeconds = setup.talkSeconds
    talkEndsAt = now.addingTimeInterval(TimeInterval(setup.talkSeconds))
    hardStopAt = now.addingTimeInterval(TimeInterval(setup.seconds))
    endsAtLimit = setup.endsAtLimit
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
      let answer = try await client.redeem(setup.connectionId, offer)
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

    turns = turns.addingTypedReply(trimmed)
    learnerSpokeSinceCheck = true
    settle?.cancel()

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

  func toggleMute() {
    guard phase == .live, !micBlocked else {
      return
    }

    muted.toggle()
    transport?.send(.mute(muted))
  }

  /// Returns what it saves whether or not the hangup went through: completing hangs it up too before
  /// anything is reviewed. Nil only for a call that never got a connection.
  func finish() async -> Components.Schemas.LanguageConversationCompletionInput? {
    guard let connectionId else {
      return nil
    }

    _ = await release()

    return .init(
      connectionId: connectionId,
      spokenSeconds: min(turns.spokenSeconds, 1260),
      timeZone: TimeZone.current.identifier,
      turns: turns.conversationTurns,
      usedHelp: false)
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

    // A start cancelled meanwhile never connects: its reservation is ended at once.
    guard isCurrent() else {
      Task { [client] in _ = await client.end(setup.connectionId) }
      return nil
    }

    connectionId = setup.connectionId
    closeConfirmed = false
    endedAtDeadline = false
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
      turns = turns.adding(delta, speaker: speaker, startMs: startMs, endMs: endMs)

      if speaker == .learner {
        ending?.learnerHeard(at: now)
        learnerSpokeSinceCheck = true
        settle?.cancel()
      } else {
        ending?.characterSpoke(at: now, startMs: startMs)
        replyGaps.characterSpoke(at: now)
        characterTurn()
      }
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

  /// An exam's own prompts, at their times, until the ending starts.
  private func sendExamCues() {
    guard let liveSince, let cues = conversation.speakingTask?.cues, ending?.armed == nil,
      examCuesSent < cues.count,
      Date.now.timeIntervalSince(liveSince) >= TimeInterval(cues[examCuesSent].atSeconds)
    else {
      return
    }

    send(LiveCallCue(channel: .instructions, text: cues[examCuesSent].say))
    examCuesSent += 1
  }

  private func advance(_ now: Date = .now) {
    guard phase == .live, let script else {
      return
    }

    for action in ending?.advance(to: now) ?? [] {
      switch action {
      case .send(.opening):
        sendOpening(script.cues.opening)
      case .send(.checkIn):
        send(script.cues.checkIn)
      case .send(.goodbye):
        sendGoodbye(script.cues.goodbye)
      case .send(.goodbyeDone):
        sendGoodbye(script.cues.goodbyeDone)
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
  private func sendGoodbye(_ cue: LiveCallCue) {
    goodbyeCues += 1
    send(cue, eventId: "\(Self.goodbyeEventPrefix)\(goodbyeCues)")
  }

  /// The character's next words answer the cue, not the learner: they aren't a reply gap.
  private func send(_ cue: LiveCallCue, delegationId: String? = nil, eventId: String? = nil) {
    transport?.send(.append(cue, delegationId: delegationId, eventId: eventId))

    if cue.channel != .thinking {
      replyGaps.cueSent()
    }
  }

  private func characterTurn() {
    // An exam task's one goal is the task itself, graded when the call ends.
    guard learnerSpokeSinceCheck, conversation.speakingTask == nil else {
      return
    }

    settle?.cancel()
    settle = Task { [weak self] in
      try? await Task.sleep(for: Self.replySettled)

      guard !Task.isCancelled, let self else {
        return
      }

      self.learnerSpokeSinceCheck = false
      await self.checkObjectives()
    }
  }

  /// One check at a time; a turn that ends meanwhile is checked right after it.
  private func checkObjectives() async {
    guard !checking else {
      checkAgain = true
      return
    }

    checking = true

    repeat {
      checkAgain = false
      let sentAt = Date.now
      let check = await client.checkObjectives(turns.conversationTurns)

      guard phase == .live, let check else {
        continue
      }

      if check.objectivesMet.count > metLabels.count {
        metLabels = check.objectivesMet
      }

      let now = Date.now

      if let ending, ending.armed == nil {
        // A goodbye the learner has talked past since it was checked isn't the end.
        if check.goodbye, !ending.hasLearnerActed(after: sentAt) {
          self.ending?.saidGoodbye(at: now)
        } else if conversation.objectives.allSatisfy({ check.objectivesMet.contains($0.label) }) {
          self.ending?.goalsMet(at: now)
        } else if let progress = check.progress?.value1 {
          send(progress)
        }
      }

      advance(now)
    } while checkAgain

    checking = false
  }

  /// The connection went away without GPT-Live saying the session closed: our server hanging it up
  /// at its deadline closes the channel that way, and that call ended normally; anything else
  /// lost it.
  private func lost(run: Int) {
    guard run == attempt, phase == .connecting || phase == .live else {
      return
    }

    let wasLive = phase == .live

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
          conversationKind: conversation.kind.analyticsName, delegations: delegations,
          durationSeconds: liveSince.map { Int(Date.now.timeIntervalSince($0).rounded()) } ?? 0,
          learnerTurns: turns.filter { $0.speaker == .learner }.count, reason: reason.rawValue,
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
    signals = Signals()
    transport?.silence()
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

extension LanguageConversation.KindPayload {
  /// Core's `ConversationKind` in analytics.
  fileprivate var analyticsName: String {
    switch self {
    case .practice: "practice"
    case .checkpoint: "checkpoint"
    case .speakingMock: "speaking_mock"
    case .examSpeaking: "exam_speaking"
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
      redeem: { connectionId, offer in
        let answer = await voice.cache.mutate { identity in
          try await api.redeemSdp(
            conversationId: conversationId, connectionId: connectionId, offer: offer,
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
