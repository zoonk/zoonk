import Foundation

/// When a call opens, checks on a quiet learner, says goodbye and hangs up: the rules main and
/// Android run too, fed with what happened and when so they run on any clock.
///
/// GPT-Live has no end-of-turn or end-of-playback event, so the rules read the character's
/// transcript fragments, the learner's microphone, transcripts and typing, and GPT-Live's
/// acknowledgments of the cues. The hard stop (the server's deadline, past the talk time by the
/// wrap-up) is the one ending that can cut a learner off: the others wait for the character's
/// goodbye and a quiet moment after it.
struct LiveCallEnding {
  enum Reason: Equatable {
    /// The talk time ran out.
    case time
    /// Every goal was met.
    case done
    /// The learner said goodbye and the character said it back.
    case goodbye
    /// The learner stayed quiet through a check-in.
    case quiet
  }

  enum Cue: Equatable {
    case opening
    case goodbye
    case goodbyeDone
    case checkIn
  }

  enum Action: Equatable {
    /// `whileLearnerSpeaks`: measured, a goodbye said aloud at once (commentary) made the character
    /// talk over a learner who paused mid-answer; as quiet context (thinking) it waited for them.
    case send(Cue, whileLearnerSpeaks: Bool = false)
    /// Nil: the hard stop.
    case hangUp(Reason?)
  }

  /// The setup's timings, in milliseconds.
  typealias Timing = Components.Schemas.LiveCallTiming

  /// The microphone counts as speaking this long after it last passed the speech threshold:
  /// WebRTC's level is sampled, and short pauses between words stay one turn.
  static let micHangover: TimeInterval = 1

  /// Measured over WebRTC: a cue's answer began 200 ms before its acknowledgment's `start_ms`.
  /// Words from before the cue started earlier than this, since the cue waits for the character to
  /// be quiet for `characterQuietMs`.
  private static let goodbyeLeadMs = 500.0

  private(set) var armed: Reason?
  private(set) var isGoodbyeSaid = false

  private let timing: Timing
  private let liveAt: Date
  private let talkEndsAt: Date
  private let hardStopAt: Date
  private var armedAt: Date?
  private var lastCharacterAt: Date?
  private var lastMicAt: Date?
  /// The learner's own words came back as a transcript, about 1.5 s after they said them.
  private var lastHeardAt: Date?
  private var lastTypedAt: Date?
  private var lastSentAt: Date?
  private var openingAcknowledgedAt: Date?
  private var openingRetried = false
  private var cueSentAt: Date?
  private var cueSends = 0
  private var goodbyeFromMs: Double?
  /// The latest start of the character's words heard after the goodbye cue, before its
  /// acknowledgment came.
  private var heardBeforeAcknowledgmentMs: Double?
  /// The current quiet stretch starts here, when the last sound anyone made stopped: ahead of now
  /// while someone is still making one.
  private var silenceFrom: Date
  private var checkedIn = false
  private var isOver = false

  init(timing: Timing, liveAt: Date, talkEndsAt: Date, hardStopAt: Date) {
    self.timing = timing
    self.liveAt = liveAt
    self.talkEndsAt = talkEndsAt
    self.hardStopAt = hardStopAt
    silenceFrom = liveAt
  }

  func isCharacterSpeaking(at now: Date) -> Bool {
    isRecent(lastCharacterAt, at: now, within: seconds(timing.characterQuietMs))
  }

  /// The caller reports no microphone speech while muted.
  func isLearnerSpeaking(at now: Date) -> Bool {
    isRecent(lastMicAt, at: now, within: Self.micHangover)
  }

  /// "Take your time." on screen: nobody has made a sound for a while.
  func isQuietLong(at now: Date) -> Bool {
    now.timeIntervalSince(silenceFrom) >= seconds(timing.quietHintMs)
  }

  /// `startMs` places the fragment on the session's timeline, where acknowledgments are too.
  mutating func characterSpoke(at now: Date, startMs: Double) {
    lastCharacterAt = now

    // The character's answer to its own check-in doesn't restart the stretch it checks in on.
    if !checkedIn {
      silenceFrom = max(silenceFrom, now.addingTimeInterval(seconds(timing.characterQuietMs)))
    }

    guard cueSentAt != nil else {
      return
    }

    if let goodbyeFromMs {
      isGoodbyeSaid = isGoodbyeSaid || startMs >= goodbyeFromMs - Self.goodbyeLeadMs
    } else {
      heardBeforeAcknowledgmentMs = max(heardBeforeAcknowledgmentMs ?? startMs, startMs)
    }
  }

  /// A microphone sample above the speech threshold.
  mutating func learnerSpoke(at now: Date) {
    lastMicAt = now
    learnerActed(until: now.addingTimeInterval(Self.micHangover))
  }

  /// The learner's words came back as a transcript: they spoke, even when the microphone's level
  /// missed a soft voice.
  mutating func learnerHeard(at now: Date) {
    lastHeardAt = now
    learnerActed(until: now)
  }

  /// A key typed in the reply field.
  mutating func learnerTyped(at now: Date) {
    lastTypedAt = now
    learnerActed(until: now)
  }

  /// A typed reply went out.
  mutating func learnerSent(at now: Date) {
    lastSentAt = now
    lastTypedAt = nil
    learnerActed(until: now)
  }

  mutating func openingAcknowledged(at now: Date) {
    openingAcknowledgedAt = openingAcknowledgedAt ?? now
  }

  /// GPT-Live took a goodbye cue into its timeline at `startMs`: what the character says from
  /// about there is the goodbye, and words heard just before the acknowledgment count too.
  mutating func goodbyeAcknowledged(startMs: Double) {
    guard cueSentAt != nil, goodbyeFromMs == nil else {
      return
    }

    goodbyeFromMs = startMs

    if let heardBeforeAcknowledgmentMs, heardBeforeAcknowledgmentMs >= startMs - Self.goodbyeLeadMs
    {
      isGoodbyeSaid = true
    }
  }

  /// An objective check's answer for the transcript as it was at `snapshotAt`. True when its
  /// progress note should go out.
  ///
  /// A mutual goodbye leaves only the hang-up: an ending that already started keeps its reason and
  /// skips its own goodbye, so the character doesn't say it twice, unless that cue already went
  /// out. A goodbye the learner has talked past since the snapshot isn't the end.
  mutating func checked(at now: Date, snapshotAt: Date, goodbye: Bool, allGoalsMet: Bool) -> Bool {
    if goodbye, !(lastLearnerAt.map { $0 > snapshotAt } ?? false) {
      arm(.goodbye, at: now)

      if cueSentAt == nil {
        isGoodbyeSaid = true
      }

      return false
    }

    guard armed == nil else {
      return false
    }

    if allGoalsMet {
      arm(.done, at: now)
      return false
    }

    return true
  }

  /// What to do now. Call it after every event and on a steady tick.
  mutating func advance(to now: Date) -> [Action] {
    guard !isOver else {
      return []
    }

    if now >= hardStopAt {
      isOver = true
      return [.hangUp(nil)]
    }

    var actions: [Action] = []

    // Before the opening retry: a call whose talk time is up doesn't greet again.
    if now >= talkEndsAt {
      arm(.time, at: now)
    }

    if openingToRetry(at: now) {
      actions.append(.send(.opening))
    }

    if armed == nil {
      let quiet = now.timeIntervalSince(silenceFrom)

      if quiet >= seconds(timing.quietGoodbyeMs) {
        arm(.quiet, at: now)
      } else if !checkedIn, quiet >= seconds(timing.checkInMs) {
        checkedIn = true
        actions.append(.send(.checkIn))
      }
    }

    if let cue = goodbyeToSend(at: now) {
      actions.append(.send(cue, whileLearnerSpeaks: isLearnerTalking(at: now)))
    }

    if isGoodbyeSaid, now.timeIntervalSince(lastActivity) >= seconds(timing.goodbyeQuietMs) {
      isOver = true
      actions.append(.hangUp(armed))
    }

    return actions
  }

  @discardableResult
  private mutating func arm(_ reason: Reason, at now: Date) -> Bool {
    guard armed == nil else {
      return false
    }

    armed = reason
    armedAt = now
    return true
  }

  /// What the learner does starts a new stretch, with its own check-in, once it stops.
  private mutating func learnerActed(until stop: Date) {
    silenceFrom = max(silenceFrom, stop)
    checkedIn = false
  }

  /// The microphone hears them, or their words just came back as a transcript.
  private func isLearnerTalking(at now: Date) -> Bool {
    isLearnerSpeaking(at: now)
      || isRecent(lastHeardAt, at: now, within: seconds(timing.characterQuietMs))
  }

  /// The opening goes out as the call goes live (`LiveCall` sends it). Measured: a slow session
  /// can take 6.7 s to speak, so it's sent again only once GPT-Live acknowledged it and the
  /// character still stayed silent.
  private mutating func openingToRetry(at now: Date) -> Bool {
    guard !openingRetried, armed == nil, lastCharacterAt == nil, let openingAcknowledgedAt,
      now.timeIntervalSince(openingAcknowledgedAt) >= seconds(timing.openingRetryMs)
    else {
      return false
    }

    openingRetried = true
    return true
  }

  /// Once the character is quiet and no reply is being typed: at once while the learner talks
  /// (GPT-Live waits for them to finish), after the character answered a reply they typed, or
  /// when they leave the floor a while. Sent again once when nothing at all followed it.
  private mutating func goodbyeToSend(at now: Date) -> Cue? {
    guard let armed, armed != .goodbye, !isGoodbyeSaid else {
      return nil
    }

    let cue: Cue = armed == .done ? .goodbyeDone : .goodbye

    guard let cueSentAt else {
      guard isGoodbyeDue(at: now) else {
        return nil
      }

      self.cueSentAt = now
      cueSends = 1
      return cue
    }

    guard cueSends == 1,
      now.timeIntervalSince(max(cueSentAt, lastActivity)) >= seconds(timing.goodbyeRetryMs)
    else {
      return nil
    }

    cueSends = 2
    return cue
  }

  private func isGoodbyeDue(at now: Date) -> Bool {
    let characterQuiet = seconds(timing.characterQuietMs)
    let answerWait = seconds(timing.answerWaitMs)

    if isCharacterSpeaking(at: now) || isRecent(lastTypedAt, at: now, within: characterQuiet) {
      return false
    }

    // Measured: a goodbye sent with a typed reply was answered as part of the reply and never
    // said, so it waits for the character to answer the reply, whatever the microphone or a late
    // transcript says meanwhile.
    if let lastSentAt, let armedAt, lastSentAt >= armedAt {
      return lastCharacterAt.map { $0 > lastSentAt } ?? false
        || now.timeIntervalSince(lastSentAt) >= answerWait
    }

    if armed == .quiet || isLearnerTalking(at: now) {
      return true
    }

    let characterStop = lastCharacterAt?.addingTimeInterval(characterQuiet) ?? liveAt
    let floorSince = max(characterStop, lastLearnerAt ?? .distantPast)
    return now.timeIntervalSince(floorSince) >= answerWait
  }

  private var lastLearnerAt: Date? {
    [lastMicAt, lastHeardAt, lastTypedAt, lastSentAt].compactMap(\.self).max()
  }

  private var lastActivity: Date {
    [lastCharacterAt, lastLearnerAt].compactMap(\.self).max() ?? liveAt
  }

  private func isRecent(_ date: Date?, at now: Date, within interval: TimeInterval) -> Bool {
    date.map { now.timeIntervalSince($0) < interval } ?? false
  }

  private func seconds(_ milliseconds: Int) -> TimeInterval {
    TimeInterval(milliseconds) / 1000
  }
}
