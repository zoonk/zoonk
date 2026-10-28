import AVFoundation
import Foundation
import Observation

/// What a call needs from the server and the device, so the engine runs against fakes in tests.
struct LiveCallClient {
  /// Reserves the call; `takeover` ends the learner's other open call first.
  let connect: @MainActor (_ takeover: Bool) async -> CallReservation
  /// Trades the WebRTC offer for GPT-Live's answer.
  let redeem: @MainActor (_ connectionId: String, _ offer: String) async throws -> String
  /// Has the server hang up: whether it already had at the call's deadline, nil if unconfirmed.
  let end: @MainActor (_ connectionId: String) async -> Bool?
  /// Every goal met so far, from what was said; nil when the check didn't run.
  let checkObjectives: @MainActor ([ConversationTurn]) async -> [String]?
  let makeTransport: @MainActor () -> any LiveCallTransport
  /// Asks for the microphone; false when the learner said no (the call still runs, typed).
  let requestMicrophone: @MainActor () async -> Bool
}

/// A live call on GPT-Live, as main's `useLiveCall` runs it. The microphone is asked for first,
/// so the permission prompt never takes time from the call; then the call is reserved on the
/// server, which fixes its deadline and creates the session; the device sends its audio and plays
/// the character's voice over WebRTC. The transcript builds up from both sides, the goals are
/// checked once the character answers each learner turn, and the call wraps up before its
/// deadline. Ending it, from here or by the server, silences it at once; the server then hangs it
/// up and confirms before the peer goes and before anything is saved. Typing always works, even
/// while the call connects (those replies go out once it does).
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

  /// Why the call couldn't go on.
  enum Failure: Equatable {
    case callInProgress
    case callsPaused
    case connect
    case dropped
    case ended
    case limit
    case plusRequired
  }

  typealias EndsAtLimit = Components.Schemas.LanguageConversationSetup.EndsAtLimitPayload

  /// A session that hasn't started after this isn't going to.
  static let connectTimeout = Duration.seconds(15)
  /// The character starts wrapping up this long before the call's time is over.
  static let wrapUpSeconds: TimeInterval = 20
  /// The learner quiet this long: the character asks if they're there.
  static let silenceNudgeSeconds: TimeInterval = 20
  /// Still quiet this long after their last word, the call ends: it's paid by the second.
  static let silenceEndSeconds: TimeInterval = 45
  /// GPT-Live usually opens within a second; still silent after this, it's told again once.
  static let openingRetry = Duration.seconds(5)
  /// The character's answer has settled once its transcript stays quiet this long.
  static let replySettled = Duration.milliseconds(1500)

  private(set) var phase = Phase.idle
  private(set) var failure: Failure?
  private(set) var limit: CallLimit?
  private(set) var turns: [TranscriptTurn] = []
  private(set) var metLabels: [String]
  private(set) var muted = false
  private(set) var micBlocked = false
  private(set) var reconnecting = false
  private(set) var isCharacterTalking = false
  /// When the call went live, for its clock.
  private(set) var liveSince: Date?
  /// The plan's call time running out while the character wraps up: today's or this month's.
  private(set) var limitNear: EndsAtLimit?
  private(set) var limitSeconds: Int

  @ObservationIgnored private let conversation: LanguageConversation
  @ObservationIgnored private let client: LiveCallClient
  @ObservationIgnored private var transport: (any LiveCallTransport)?
  @ObservationIgnored private var connectionId: String?
  @ObservationIgnored private var attempt = 0
  @ObservationIgnored private var closeConfirmed = false
  @ObservationIgnored private var endedAtDeadline = false
  @ObservationIgnored private var ending: Task<Bool, Never>?
  @ObservationIgnored private var endsAt: Date?
  @ObservationIgnored private var endsAtLimit: EndsAtLimit?
  @ObservationIgnored private var waitingReplies: [String] = []
  @ObservationIgnored private var timers: [Task<Void, Never>] = []
  @ObservationIgnored private var openingRetry: Task<Void, Never>?
  @ObservationIgnored private var settle: Task<Void, Never>?
  @ObservationIgnored private var talking: Task<Void, Never>?
  @ObservationIgnored private var lastLearnerAt = Date.now
  @ObservationIgnored private var nudged = false
  @ObservationIgnored private var wrappedUp = false
  @ObservationIgnored private var cuesSent = 0
  @ObservationIgnored private var learnerSpoke = false
  @ObservationIgnored private var checking = false
  @ObservationIgnored private var checkAgain = false

  init(conversation: LanguageConversation, client: LiveCallClient) {
    self.conversation = conversation
    self.client = client
    metLabels = conversation.objectives.filter(\.met).map(\.label)
    limitSeconds = conversation.minutes * 60
  }

  /// Starts a call: the microphone, then the reservation, then the peer. Leaving the screen or
  /// starting again cancels a start still on its way.
  func start(takeover: Bool = false) async {
    attempt += 1
    let mine = attempt
    phase = .connecting
    failure = nil

    micBlocked = !(await client.requestMicrophone())

    guard attempt == mine else {
      return
    }

    let reservation = await reserve(takeover: takeover, isCurrent: { self.attempt == mine })

    guard attempt == mine, let reservation else {
      return
    }

    guard case .ready(let setup) = reservation else {
      fail(failure(for: reservation), limit: reservation.callLimit)
      return
    }

    // The time the server said was left, from now: the device's clock can be off.
    endsAt = Date.now.addingTimeInterval(TimeInterval(setup.seconds))
    endsAtLimit = setup.endsAtLimit

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

  /// Ends the call from here: silenced at once, then saved by the screen.
  func hangUp() {
    guard phase == .connecting || phase == .live else {
      return
    }

    silence()
    phase = .ended
  }

  /// Leaving the screen ends the call too: one still going shows as dropped, and the server
  /// hangs it up.
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

  /// A reply the learner typed joins the transcript at once; while the call connects it waits.
  func sendText(_ text: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !trimmed.isEmpty, phase == .connecting || phase == .live else {
      return
    }

    turns = turns.addingTypedReply(trimmed)
    learnerTurn()

    if phase == .live {
      transport?.send(.instructions(LiveCallCue.typedReply(trimmed)))
    } else {
      waitingReplies.append(trimmed)
    }
  }

  /// The microphone button mutes the learner during a live call: GPT-Live ignores their audio.
  func toggleMute() {
    guard phase == .live, !micBlocked else {
      return
    }

    muted.toggle()
    transport?.send(.mute(muted))
  }

  /// Hangs the call up on the server and returns what it saves, whether or not the hangup went
  /// through: completing hangs it up too before anything is reviewed. Nil only for a call that
  /// never got a connection.
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

  /// Silences the call and has the server hang it up: true once the server confirmed, and only
  /// then does the peer go. One request at a time; asking again after a failure sends a new one.
  func release() async -> Bool {
    silence()

    guard let connectionId, !closeConfirmed else {
      closeTransport()
      return true
    }

    if let ending {
      return await ending.value
    }

    let task = Task { [client] in
      let atDeadline = await client.end(connectionId)

      if let atDeadline {
        self.closeConfirmed = true
        self.endedAtDeadline = atDeadline
      }

      self.ending = nil
      return atDeadline != nil
    }

    ending = task
    let closed = await task.value

    if closed {
      closeTransport()
    }

    return closed
  }

  // MARK: - Reservation

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

  // MARK: - Events

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

    guard phase == .live else {
      return
    }

    switch event {
    case .started:
      break
    case .closed:
      hangUp()
    case .transcript(let speaker, let delta, let startMs, let endMs):
      turns = turns.adding(delta, speaker: speaker, startMs: startMs, endMs: endMs)

      if speaker == .learner {
        learnerTurn()
      } else {
        openingRetry?.cancel()
        characterTurn()
      }
    case .delegation(let id):
      transport?.send(.thinking(LiveCallCue.noBackend, delegationId: id))
    }
  }

  private func goLive() {
    let now = Date.now
    liveSince = now
    lastLearnerAt = now

    if let endsAt {
      limitSeconds = max(0, Int(endsAt.timeIntervalSince(now).rounded()))
    }

    phase = .live
    reconnecting = false

    let opening = LiveCallCue.opening(conversation.openingLine)
    transport?.send(.instructions(opening))

    openingRetry = Task { [weak self] in
      try? await Task.sleep(for: Self.openingRetry)

      guard !Task.isCancelled, let self, self.phase == .live else {
        return
      }

      self.transport?.send(.instructions(opening))
    }

    for reply in waitingReplies {
      transport?.send(.instructions(LiveCallCue.typedReply(reply)))
    }

    waitingReplies = []
    startClock()
  }

  /// The call's clock while it's live: an exam task's cues as it runs, the wrap-up before the end,
  /// a nudge when the learner is quiet, and the end at the deadline or after a long silence.
  private func startClock() {
    let cues = conversation.speakingTask?.cues ?? []

    timers.append(
      Task { [weak self] in
        while !Task.isCancelled {
          try? await Task.sleep(for: .milliseconds(500))

          guard let self, self.phase == .live, let start = self.liveSince, let endsAt = self.endsAt
          else {
            return
          }

          let now = Date.now
          let elapsed = now.timeIntervalSince(start)
          let quiet = now.timeIntervalSince(self.lastLearnerAt)

          if self.cuesSent < cues.count, !self.wrappedUp,
            elapsed >= TimeInterval(cues[self.cuesSent].atSeconds)
          {
            self.transport?.send(.instructions(cues[self.cuesSent].say))
            self.cuesSent += 1
          }

          if !self.wrappedUp, now >= endsAt.addingTimeInterval(-Self.wrapUpSeconds) {
            self.wrappedUp = true
            self.limitNear = self.endsAtLimit
            self.transport?.send(.instructions(LiveCallCue.wrapUp))
          }

          if !self.nudged, !self.wrappedUp, quiet >= Self.silenceNudgeSeconds {
            self.nudged = true
            self.transport?.send(.instructions(LiveCallCue.silence))
          }

          if now >= endsAt || quiet >= Self.silenceEndSeconds {
            self.hangUp()
          }
        }
      })
  }

  /// Every word the learner says or types keeps the call from ending on its silence timeout, and
  /// the character's next answer gets its goals checked.
  private func learnerTurn() {
    lastLearnerAt = .now
    nudged = false
    learnerSpoke = true
    settle?.cancel()
  }

  private func characterTurn() {
    isCharacterTalking = true
    talking?.cancel()
    talking = Task { [weak self] in
      try? await Task.sleep(for: .milliseconds(1200))

      if !Task.isCancelled {
        self?.isCharacterTalking = false
      }
    }

    // An exam task's one goal is the task itself, graded when the call ends.
    guard learnerSpoke, conversation.speakingTask == nil else {
      return
    }

    settle?.cancel()
    settle = Task { [weak self] in
      try? await Task.sleep(for: Self.replySettled)

      guard !Task.isCancelled, let self else {
        return
      }

      self.learnerSpoke = false
      await self.checkObjectives()
    }
  }

  /// One check at a time; a turn that ends meanwhile is checked right after it. GPT-Live is told
  /// where the learner is, so it wraps up once everything is done.
  private func checkObjectives() async {
    guard !checking else {
      checkAgain = true
      return
    }

    checking = true

    repeat {
      checkAgain = false
      let found = await client.checkObjectives(turns.conversationTurns)

      if let found, found.count > metLabels.count {
        metLabels = found
        let open = conversation.objectives.map(\.label).filter { !found.contains($0) }
        transport?.send(.thinking(LiveCallCue.objectivesProgress(met: found, open: open)))
      }
    } while checkAgain

    checking = false
  }

  // MARK: - Ending

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
        hangUp()
      } else {
        fail(wasLive ? .dropped : .connect)
      }
    }
  }

  private func fail(_ failure: Failure, limit: CallLimit? = nil) {
    self.failure = failure
    self.limit = limit
    phase = .failed
    reconnecting = false
    Task { _ = await release() }
  }

  /// Silences the call on this side for good: the learner's audio stops going out and the
  /// character's stops playing, while the server closes the session.
  private func silence() {
    for timer in timers {
      timer.cancel()
    }

    timers = []
    openingRetry?.cancel()
    settle?.cancel()
    talking?.cancel()
    isCharacterTalking = false
    transport?.silence()
  }

  private func closeTransport() {
    transport?.close()
    transport = nil
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
  /// The live client: the API for the call's conversation, WebRTC, and the system's microphone
  /// prompt. Every request runs under the session that started the call.
  @MainActor
  static func live(conversationId: String, voice: VoiceServices, api: LiveCallAPI) -> LiveCallClient
  {
    LiveCallClient(
      connect: { takeover in
        let reservation =
          (try? await voice.perform { token in
            await api.connect(conversationId: conversationId, takeover: takeover, token: token)
          }) ?? .failed

        if case .ready = reservation {
          // The call holds the plan's call time from now.
          voice.cache.invalidate([.allowance])
        }

        return reservation
      },
      redeem: { connectionId, offer in
        try await voice.perform { token in
          try await api.redeemSdp(
            conversationId: conversationId, connectionId: connectionId, offer: offer, token: token)
        }
      },
      end: { connectionId in
        let ended = try? await voice.perform { token in
          await api.end(conversationId: conversationId, connectionId: connectionId, token: token)
        }

        if ended != nil {
          voice.cache.invalidate([.allowance])
        }

        return ended ?? nil
      },
      checkObjectives: { turns in
        (try? await voice.perform { token in
          await api.checkObjectives(conversationId: conversationId, turns: turns, token: token)
        }) ?? nil
      },
      makeTransport: { WebRTCLiveCallTransport() },
      requestMicrophone: { await AVAudioApplication.requestRecordPermission() })
  }
}
