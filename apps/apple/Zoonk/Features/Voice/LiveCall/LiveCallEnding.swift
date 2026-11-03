import Foundation

/// When a call opens, checks on a quiet learner, says goodbye and hangs up: the rules main and
/// Android run too, fed with what happened and when so they run on any clock.
///
/// GPT-Live has no end-of-turn or end-of-playback event, so the rules read the character's
/// transcript fragments and the learner's microphone and typing. The hard stop (the server's
/// deadline, past the talk time by the wrap-up) is the one ending that can cut a learner off: the
/// others wait for the character's goodbye and a quiet moment after it.
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
    case send(Cue)
    /// Nil: the hard stop.
    case hangUp(Reason?)
  }

  /// The setup's timings, in milliseconds.
  typealias Timing = Components.Schemas.LiveCallTiming

  /// The microphone counts as speaking this long after it last passed the speech threshold:
  /// WebRTC's level is sampled, and short pauses between words stay one turn.
  static let micHangover: TimeInterval = 1

  private(set) var armed: Reason?
  private(set) var isGoodbyeSaid = false

  private let timing: Timing
  private let liveAt: Date
  private let talkEndsAt: Date
  private let hardStopAt: Date
  private var lastCharacterAt: Date?
  private var lastMicAt: Date?
  private var lastTypedAt: Date?
  private var openingSends = 0
  private var cueSentAt: Date?
  private var cueSends = 0
  private var characterSinceCue = false
  private var goodbyeHeardFromMs: Double?
  /// Where the silence the check-in was sent in began: the character's answer to it doesn't start
  /// a new one.
  private var checkedInSilence: Date?
  private var isOver = false

  init(timing: Timing, liveAt: Date, talkEndsAt: Date, hardStopAt: Date) {
    self.timing = timing
    self.liveAt = liveAt
    self.talkEndsAt = talkEndsAt
    self.hardStopAt = hardStopAt
  }

  func isCharacterSpeaking(at now: Date) -> Bool {
    guard let lastCharacterAt else {
      return false
    }

    return now.timeIntervalSince(lastCharacterAt) < seconds(timing.characterQuietMs)
  }

  /// The caller reports no microphone speech while muted, so then only typing counts.
  func isLearnerActive(at now: Date) -> Bool {
    if let lastMicAt, now.timeIntervalSince(lastMicAt) < Self.micHangover {
      return true
    }

    if let lastTypedAt, now.timeIntervalSince(lastTypedAt) < seconds(timing.characterQuietMs) {
      return true
    }

    return false
  }

  func isLearnerSpeaking(at now: Date) -> Bool {
    guard let lastMicAt else {
      return false
    }

    return now.timeIntervalSince(lastMicAt) < Self.micHangover
  }

  /// The learner spoke or typed since then.
  func hasLearnerActed(after date: Date) -> Bool {
    [lastMicAt, lastTypedAt].contains { $0.map { $0 > date } ?? false }
  }

  /// "Take your time." on screen: the learner has left the character unanswered a while.
  func isQuietLong(at now: Date) -> Bool {
    guard let silence = silenceStart(at: now) else {
      return false
    }

    return now.timeIntervalSince(silence) >= seconds(timing.quietHintMs)
  }

  /// `startMs` places the fragment on the session's timeline, where acknowledgments are too.
  mutating func characterSpoke(at now: Date, startMs: Double) {
    lastCharacterAt = now

    if cueSentAt != nil {
      characterSinceCue = true
    }

    if let goodbyeHeardFromMs, startMs >= goodbyeHeardFromMs {
      isGoodbyeSaid = true
    }
  }

  /// A microphone sample above the speech threshold.
  mutating func learnerSpoke(at now: Date) {
    lastMicAt = now
    learnerActed()
  }

  /// A key typed in the reply field, or a reply sent.
  mutating func learnerTyped(at now: Date) {
    lastTypedAt = now
    learnerActed()
  }

  /// GPT-Live took in a goodbye cue at `startMs` on its timeline: what the character says from
  /// there is the goodbye.
  mutating func goodbyeAcknowledged(startMs: Double) {
    goodbyeHeardFromMs = min(goodbyeHeardFromMs ?? startMs, startMs)
  }

  mutating func goalsMet() {
    arm(.done)
  }

  /// The learner said goodbye and the character said it back: it only remains to hang up.
  mutating func saidGoodbye() {
    if arm(.goodbye) {
      isGoodbyeSaid = true
    }
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

    if let cue = openingToSend(at: now) {
      actions.append(.send(cue))
    }

    if armed == nil, now >= talkEndsAt {
      arm(.time)
    }

    if armed == nil, let silence = silenceStart(at: now) {
      let quiet = now.timeIntervalSince(silence)

      if quiet >= seconds(timing.quietGoodbyeMs) {
        arm(.quiet)
      } else if checkedInSilence == nil, quiet >= seconds(timing.checkInMs) {
        checkedInSilence = silence
        actions.append(.send(.checkIn))
      }
    }

    if let cue = goodbyeToSend(at: now) {
      actions.append(.send(cue))
    }

    if isGoodbyeSaid, now.timeIntervalSince(lastActivity) >= seconds(timing.goodbyeQuietMs) {
      isOver = true
      actions.append(.hangUp(armed))
    }

    return actions
  }

  @discardableResult
  private mutating func arm(_ reason: Reason) -> Bool {
    guard armed == nil else {
      return false
    }

    armed = reason
    return true
  }

  private mutating func learnerActed() {
    checkedInSilence = nil
  }

  /// Sent once as the call goes live, and once more if the character stays silent.
  private mutating func openingToSend(at now: Date) -> Cue? {
    if openingSends == 0 {
      openingSends = 1
      return .opening
    }

    guard openingSends == 1, armed == nil, lastCharacterAt == nil,
      now.timeIntervalSince(liveAt) >= seconds(timing.openingRetryMs)
    else {
      return nil
    }

    openingSends = 2
    return .opening
  }

  /// Once the character is quiet: at once when the learner is answering (GPT-Live waits for them
  /// to finish), else when they start or after a while without them. Sent again once if nothing
  /// came of it.
  private mutating func goodbyeToSend(at now: Date) -> Cue? {
    guard let armed, armed != .goodbye, !isGoodbyeSaid, !isCharacterSpeaking(at: now) else {
      return nil
    }

    let cue: Cue = armed == .done ? .goodbyeDone : .goodbye

    guard let cueSentAt else {
      let floorSince = [characterStop, lastTypedAt, lastMicAt].compactMap(\.self).max() ?? liveAt
      let isDue =
        armed == .quiet || isLearnerActive(at: now)
        || now.timeIntervalSince(floorSince) >= seconds(timing.answerWaitMs)

      guard isDue else {
        return nil
      }

      self.cueSentAt = now
      cueSends = 1
      return cue
    }

    // The wait starts once the learner leaves the floor, not when the cue went out while they
    // were still talking.
    let waitingSince = max(cueSentAt, lastActivity)

    guard cueSends == 1, !characterSinceCue,
      now.timeIntervalSince(waitingSince) >= seconds(timing.goodbyeRetryMs)
    else {
      return nil
    }

    cueSends = 2
    return cue
  }

  /// One unanswered stretch: from when the character stopped, or the call went live, until the
  /// learner speaks or types. The character answering the check-in doesn't start a new one.
  private func silenceStart(at now: Date) -> Date? {
    if let checkedInSilence {
      return checkedInSilence
    }

    let learnerAt = [lastMicAt, lastTypedAt].compactMap(\.self).max()

    guard let lastCharacterAt, let characterStop else {
      return learnerAt == nil ? liveAt : nil
    }

    if let learnerAt, learnerAt >= lastCharacterAt {
      return nil
    }

    return now >= characterStop ? characterStop : nil
  }

  private var characterStop: Date? {
    lastCharacterAt?.addingTimeInterval(seconds(timing.characterQuietMs))
  }

  private var lastActivity: Date {
    [lastCharacterAt, lastMicAt, lastTypedAt].compactMap(\.self).max() ?? liveAt
  }

  private func seconds(_ milliseconds: Int) -> TimeInterval {
    TimeInterval(milliseconds) / 1000
  }
}
