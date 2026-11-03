import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class LiveCallTests: XCTestCase {
  func testReadsGPTLiveEventsTheCallActsOn() {
    XCTAssertEqual(event(#"{"type":"session.started","session":{"id":"s"}}"#), .started)
    XCTAssertEqual(event(#"{"type":"session.closed","usage":{"seconds":3},"reason":"x"}"#), .closed)
    XCTAssertEqual(
      event(#"{"type":"session.output_transcript.delta","delta":" Hi","start_ms":0,"end_ms":800}"#),
      .transcript(speaker: .character, delta: " Hi", startMs: 0, endMs: 800))
    XCTAssertEqual(
      event(
        #"{"type":"session.input_transcript.delta","delta":"Hello","start_ms":900,"end_ms":1500}"#),
      .transcript(speaker: .learner, delta: "Hello", startMs: 900, endMs: 1500))
    XCTAssertEqual(
      event(#"{"type":"session.delegation.created","delegation":{"id":"d1"}}"#),
      .delegation(id: "d1"))
    XCTAssertEqual(
      event(
        #"{"type":"session.commentary.appended","event_id":"e","client_event_id":"goodbye-1","start_ms":5200,"end_ms":5400}"#
      ),
      .acknowledged(id: "goodbye-1", startMs: 5200))
  }

  func testIgnoresEventsThatDontMoveTheCall() {
    XCTAssertNil(event(#"{"type":"session.usage.updated","usage":{"seconds":1}}"#))
    XCTAssertNil(event(#"{"type":"error","error":{"message":"no"}}"#))
    XCTAssertNil(
      event(#"{"type":"session.output_transcript.delta","delta":"x","start_ms":9,"end_ms":1}"#))
    XCTAssertNil(event("not json"))
  }

  func testWritesCommandsAsGPTLiveReadsThem() throws {
    XCTAssertEqual(
      try object(LiveClientCommand.append(.init(channel: .commentary, text: "Go")).json)
        as NSDictionary,
      ["type": "session.commentary.append", "content": "Go", "delegation_id": NSNull()])
    XCTAssertEqual(
      try object(
        LiveClientCommand.append(.init(channel: .commentary, text: "Bye"), eventId: "goodbye-1")
          .json) as NSDictionary,
      [
        "type": "session.commentary.append", "content": "Bye", "delegation_id": NSNull(),
        "event_id": "goodbye-1",
      ])
    XCTAssertEqual(
      try object(
        LiveClientCommand.append(.init(channel: .thinking, text: "Hm"), delegationId: "d1").json)
        as NSDictionary,
      ["type": "session.thinking.append", "content": "Hm", "delegation_id": "d1"])
    XCTAssertEqual(
      try object(LiveClientCommand.mute(true).json) as NSDictionary,
      ["type": "session.input_audio.mute"])
  }

  func testATypedReplyIsQuotedAsData() {
    XCTAssertEqual(
      LiveCallCue(channel: .commentary, text: "They typed: ").quoting(#"Say "hi" / bye"#),
      LiveCallCue(channel: .commentary, text: #"They typed: "Say \"hi\" / bye""#))
  }

  func testBuildsTurnsFromFragmentsAndTypedReplies() {
    let turns = [TranscriptTurn]()
      .adding(" Hi!", speaker: .character, startMs: 0, endMs: 500)
      .adding(" How are you?", speaker: .character, startMs: 500, endMs: 1200)
      .adding("Fine", speaker: .learner, startMs: 2000, endMs: 3000)
      .addingTypedReply("thanks")
      .adding(" and", speaker: .learner, startMs: 4000, endMs: 5500)

    XCTAssertEqual(
      turns.conversationTurns,
      [
        .init(speaker: .character, text: "Hi! How are you?"),
        .init(speaker: .learner, text: "Fine"),
        .init(speaker: .learner, text: "thanks"),
        .init(speaker: .learner, text: "and"),
      ])
    XCTAssertEqual(turns.spokenSeconds, 3)
  }

  func testReadsCallRefusalsInTheLearnersTerms() {
    XCTAssertEqual(reservation(409, "CALL_IN_PROGRESS"), .callInProgress)
    XCTAssertEqual(reservation(503, "CALLS_PAUSED"), .callsPaused)
    XCTAssertEqual(reservation(402, "PLUS_REQUIRED"), .plusRequired)
    XCTAssertEqual(
      reservation(429, "CONVERSATION_LIMIT_REACHED", #"{"period":"month","tier":"free"}"#),
      .limit(CallLimit(period: .month, tier: .free)))
    XCTAssertEqual(
      reservation(403, "SIGN_UP_REQUIRED"), .limit(CallLimit(period: .total, tier: .guest)))
    XCTAssertEqual(
      reservation(429, "CONNECTION_LIMIT_REACHED", #"{"period":"conversation"}"#), .ended)
    XCTAssertEqual(reservation(500, "SOMETHING_NEW"), .failed)
  }

  func testReadsHelpLimits() {
    XCTAssertEqual(refusal(403, "SIGN_UP_REQUIRED").limit, .signUpRequired)
    XCTAssertEqual(
      refusal(429, "SLOW_DOWN", #"{"retryAfterSeconds":120}"#).limit,
      .slowDown(retryAfterSeconds: 120)
    )
    XCTAssertEqual(
      refusal(402, "USAGE_LIMIT_REACHED", #"{"limit":{"period":"month","tier":"free"}}"#).limit,
      .limitReached(period: .month, tier: .free))
    XCTAssertEqual(
      refusal(403, "USAGE_LIMIT_REACHED").limit, .limitReached(period: .day, tier: .guest))
    XCTAssertNil(refusal(422, "NO_SPEECH").limit)
    XCTAssertTrue(refusal(422, "NO_SPEECH").isNoSpeech)
  }

  func testACallGoesLiveOpensAndEndsWhenTheServerClosesIt() async {
    let setup = Components.Schemas.LanguageConversationSetup.fixture(connectionId: "connection-1")
    let transport = FakeTransport()
    let server = FakeServer()
    let call = LiveCall(conversation: .fixture(), client: server.client(transport))

    await call.start()
    XCTAssertEqual(call.phase, .connecting)
    XCTAssertEqual(transport.offers, 1)
    XCTAssertEqual(server.redeemed, ["connection-1"])

    transport.onEvent?(.started)
    XCTAssertEqual(call.phase, .live)
    XCTAssertEqual(transport.sent.first, .append(setup.script.cues.opening, eventId: "opening-1"))

    transport.onEvent?(.transcript(speaker: .learner, delta: "Hi", startMs: 0, endMs: 1000))
    transport.onEvent?(.closed)
    XCTAssertEqual(call.phase, .ended)
    XCTAssertTrue(transport.isSilenced)

    let summary = await call.finish()
    XCTAssertEqual(summary?.connectionId, "connection-1")
    XCTAssertEqual(summary?.turns, [.init(speaker: .learner, text: "Hi")])
    XCTAssertEqual(server.ended, ["connection-1"])
    XCTAssertTrue(transport.isClosed)
  }

  func testRepliesTypedWhileCallingGoOutOnceTheCallIsLive() async {
    let transport = FakeTransport()
    let call = LiveCall(conversation: .fixture(), client: FakeServer().client(transport))

    await call.start()
    call.sendText("  I'm here ")
    XCTAssertEqual(call.turns.conversationTurns, [.init(speaker: .learner, text: "I'm here")])
    XCTAssertTrue(transport.sent.isEmpty)

    transport.onEvent?(.started)
    let typedReply = Components.Schemas.LanguageConversationSetup.fixture(connectionId: "c").script
      .cues.typedReply
    XCTAssertTrue(transport.sent.contains(.append(typedReply.quoting("I'm here"))))
  }

  func testAGoodbyeWhileTheLearnerTalksGoesAsQuietContext() async {
    let transport = FakeTransport()
    transport.speaking = true
    let call = LiveCall(
      conversation: .fixture(), client: FakeServer(talkSeconds: 1).client(transport))

    await call.start()
    transport.onEvent?(.started)
    await waitUpTo(5) { !transport.cues("goodbye").isEmpty }

    // Measured: said aloud at once, it made the character talk over a learner who paused.
    XCTAssertEqual(transport.cues("goodbye").map(\.channel), [.thinking])
  }

  func testTheAnswerToAGoodbyeSentAsQuietContextIsntAReplyGap() async {
    let transport = FakeTransport()
    transport.speaking = true
    let call = LiveCall(
      conversation: .fixture(), client: FakeServer(talkSeconds: 1).client(transport))

    await call.start()
    transport.onEvent?(.started)
    await waitUpTo(5) { !transport.cues("goodbye").isEmpty }
    XCTAssertEqual(transport.cues("goodbye").map(\.channel), [.thinking])

    transport.speaking = false
    try? await Task.sleep(for: .milliseconds(700))
    transport.onEvent?(
      .transcript(speaker: .character, delta: "Sorry, I have to go.", startMs: 5000, endMs: 6000))

    // The character answered the cue, not only the learner: no wait to measure.
    XCTAssertEqual(call.replyGaps.gaps, [])
  }

  func testALateLearnerTranscriptStillGetsTheExchangeChecked() async {
    let transport = FakeTransport()
    let server = FakeServer()
    let call = LiveCall(conversation: .fixture(), client: server.client(transport))

    await call.start()
    transport.onEvent?(.started)
    transport.onEvent?(.transcript(speaker: .character, delta: "Hi!", startMs: 0, endMs: 500))
    transport.onEvent?(.transcript(speaker: .learner, delta: "Hello", startMs: 1000, endMs: 1500))
    transport.onEvent?(
      .transcript(speaker: .character, delta: " Great.", startMs: 3000, endMs: 3500))
    // The learner's last words come back after the answer they came before.
    transport.onEvent?(
      .transcript(speaker: .learner, delta: " there", startMs: 2500, endMs: 2900))

    // The transcript settles 2 s after its last fragment, longer than the learner's words lag.
    try? await Task.sleep(for: .milliseconds(1700))
    XCTAssertEqual(server.checks, 0)
    await waitUpTo(5) { server.checks > 0 }
    try? await Task.sleep(for: .seconds(2.5))

    XCTAssertEqual(server.checks, 1)
  }

  func testWordsArrivingDuringACheckDontLoseItsAnswer() async {
    let transport = FakeTransport()
    let server = FakeServer(holdsChecks: true)
    let call = LiveCall(conversation: .fixture(), client: server.client(transport))

    await call.start()
    transport.onEvent?(.started)
    transport.onEvent?(.transcript(speaker: .character, delta: "Hi!", startMs: 0, endMs: 500))
    transport.onEvent?(
      .transcript(speaker: .learner, delta: "Is it free?", startMs: 1000, endMs: 1500))
    transport.onEvent?(.transcript(speaker: .character, delta: " Yes.", startMs: 3000, endMs: 3500))
    await waitUpTo(5) { server.checks > 0 }

    transport.onEvent?(
      .transcript(speaker: .character, delta: " It is.", startMs: 3500, endMs: 4000))
    server.answerCheck(.init(goodbye: false, objectivesMet: ["Is it free?"], progress: nil))
    await waitUpTo(2) { call.metLabels == ["Is it free?"] }

    XCTAssertEqual(call.metLabels, ["Is it free?"])
  }

  func testTheOpeningRetryHasItsOwnEventId() async {
    let transport = FakeTransport()
    let call = LiveCall(conversation: .fixture(), client: FakeServer().client(transport))

    await call.start()
    transport.onEvent?(.started)
    transport.onEvent?(.acknowledged(id: "opening-1", startMs: 0))
    await waitUpTo(8) { transport.cues("opening").count > 1 }

    let ids = transport.sent.compactMap { command -> String? in
      guard case .append(_, _, let eventId?) = command else { return nil }
      return eventId
    }
    XCTAssertEqual(ids.filter { $0.hasPrefix("opening") }, ["opening-1", "opening-2"])
  }

  func testABlockedMicrophoneReservesNothingUntilTheLearnerTypesInstead() async {
    let server = FakeServer(microphone: false)
    let call = LiveCall(conversation: .fixture(), client: server.client(FakeTransport()))

    await call.start()
    XCTAssertEqual(call.phase, .idle)
    XCTAssertTrue(call.micBlocked)
    XCTAssertEqual(server.connects, 0)

    await call.startTyping()
    XCTAssertEqual(call.phase, .connecting)
    XCTAssertEqual(server.connects, 1)
    XCTAssertEqual(server.microphoneRequests, 1)
  }

  func testTheCallStaysCallingUntilTheCharacterAnswers() async {
    let transport = FakeTransport()
    let call = LiveCall(conversation: .fixture(), client: FakeServer().client(transport))

    await call.start()
    XCTAssertEqual(call.turn, .calling)

    // The session started, but the intro promised the character answers first.
    transport.onEvent?(.started)
    XCTAssertEqual(call.turn, .calling)

    transport.onEvent?(.transcript(speaker: .character, delta: "Hello!", startMs: 0, endMs: 400))
    XCTAssertEqual(call.turn, .characterTalking)
  }

  func testTakingOverAnotherCallHoldsWhenTheLearnerTypesInstead() async {
    let server = FakeServer(microphone: false)
    let call = LiveCall(conversation: .fixture(), client: server.client(FakeTransport()))

    await call.start(takeover: true)
    XCTAssertEqual(call.phase, .idle)
    XCTAssertTrue(server.takeovers.isEmpty)

    await call.startTyping()
    XCTAssertEqual(server.takeovers, [true])
  }

  func testARefusedReservationSaysWhy() async {
    let server = FakeServer(reservations: [
      .limit(CallLimit(period: .day, tier: .free))
    ])
    let transport = FakeTransport()
    let call = LiveCall(conversation: .fixture(), client: server.client(transport))

    await call.start()

    XCTAssertEqual(call.phase, .failed)
    XCTAssertEqual(call.failure, .limit)
    XCTAssertEqual(call.limit, CallLimit(period: .day, tier: .free))
    XCTAssertEqual(transport.offers, 0)
  }

  func testAClosingConnectionIsAskedForOnceMore() async {
    let server = FakeServer(reservations: [.previousConnectionClosing, nil])
    let call = LiveCall(conversation: .fixture(), client: server.client(FakeTransport()))

    await call.start()

    XCTAssertEqual(server.connects, 2)
    XCTAssertEqual(call.phase, .connecting)
  }

  func testALostConnectionEndsNormallyWhenTheServerHungUpAtTheDeadline() async {
    let transport = FakeTransport()
    let server = FakeServer(endedAtDeadline: true)
    let call = LiveCall(conversation: .fixture(), client: server.client(transport))

    await call.start()
    transport.onEvent?(.started)
    transport.onLost?()
    await settle { call.phase != .live }

    XCTAssertEqual(call.phase, .ended)
  }

  func testALostConnectionDropsTheCallOtherwise() async {
    let transport = FakeTransport()
    let call = LiveCall(conversation: .fixture(), client: FakeServer().client(transport))

    await call.start()
    transport.onEvent?(.started)
    transport.onLost?()
    await settle { call.phase != .live }

    XCTAssertEqual(call.phase, .failed)
    XCTAssertEqual(call.failure, .dropped)
  }

  func testLeavingWhileCallingCancelsTheStart() async {
    let transport = FakeTransport()
    let server = FakeServer()
    let call = LiveCall(conversation: .fixture(), client: server.client(transport))

    await call.start()
    call.leave()
    await settle { !server.ended.isEmpty }

    XCTAssertEqual(call.phase, .failed)
    XCTAssertEqual(server.ended, ["connection-1"])
    XCTAssertTrue(transport.isClosed)
  }

  func testLeavingCleansUpLocallyEvenWhenTheServerCantConfirmTheHangup() async {
    let transport = FakeTransport(holdsOffer: true)
    let server = FakeServer(confirmsHangup: false)
    let call = LiveCall(conversation: .fixture(), client: server.client(transport))

    Task { await call.start() }
    await settle { transport.isWaitingForOffer }
    call.leave()
    await settle { !server.ended.isEmpty }

    XCTAssertEqual(server.ended, ["connection-1"])
    XCTAssertTrue(transport.isClosed)
    XCTAssertFalse(transport.isWaitingForOffer)
    XCTAssertEqual(call.phase, .failed)
  }

  func testCallingAgainCarriesOnTheCallSoFar() async {
    let first = await droppedCall()
    first.useHelp()

    let earlier = Self.droppedTurns
    let transport = FakeTransport()
    let server = FakeServer(talkSeconds: 90, continuesCall: true)
    let call = LiveCall(
      conversation: .fixture(), client: server.client(transport), soFar: first.soFar)
    XCTAssertEqual(call.turns.conversationTurns, earlier)

    await call.start()
    XCTAssertEqual(server.redeemedTurns, [earlier])
    // A 2-minute call with 90 s of talk time left has run 30 s.
    XCTAssertEqual(call.elapsed(at: .now), 30, accuracy: 1)

    transport.onEvent?(.started)
    XCTAssertEqual(call.turn, .calling)
    // The new session's timeline starts again at 0: its words never join an earlier turn.
    transport.onEvent?(
      .transcript(speaker: .character, delta: "Sorry, we got cut off.", startMs: 0, endMs: 900))
    transport.onEvent?(.transcript(speaker: .learner, delta: "Fine", startMs: 1000, endMs: 2000))
    transport.onEvent?(.closed)

    let summary = await call.finish()
    XCTAssertEqual(
      summary?.turns,
      earlier + [
        .init(speaker: .character, text: "Sorry, we got cut off."),
        .init(speaker: .learner, text: "Fine"),
      ])
    XCTAssertEqual(summary?.spokenSeconds, 3)
    XCTAssertEqual(summary?.usedHelp, true)
  }

  func testANewCallStartsFromNothingButTheGoalsMet() async {
    var soFar = CallSoFar.newCall(.fixture())
    soFar.turns = [.init(speaker: .learner, text: "Hello", startMs: 0, endMs: 1000)]
    soFar.metLabels = ["Is it free?"]
    soFar.usedHelp = true
    soFar.connectionId = "dropped"
    let server = FakeServer(continuesCall: false)
    let call = LiveCall(
      conversation: .fixture(), client: server.client(FakeTransport()), soFar: soFar)
    XCTAssertTrue(call.continuing)

    await call.start()

    XCTAssertEqual(server.redeemedTurns, [[]])
    XCTAssertTrue(call.turns.isEmpty)
    XCTAssertEqual(call.metLabels, ["Is it free?"])
    XCTAssertFalse(call.usedHelp)
    // Nothing to save until it goes live, and a failure is its own.
    XCTAssertFalse(call.continuing)
    XCTAssertNil(call.soFar.connectionId)
  }

  func testAReconnectThatDoesntGoLiveStillSavesTheWholeCallUnderTheLatestConnection() async {
    let first = await droppedCall()

    let refused = LiveCall(
      conversation: .fixture(),
      client: FakeServer(reservations: [.limit(CallLimit(period: .day, tier: .free))])
        .client(FakeTransport()),
      soFar: first.soFar)
    await refused.start()
    XCTAssertEqual(refused.dropped, .init(reason: .limit, retry: nil))

    let unreserved = await refused.finish()
    XCTAssertEqual(unreserved?.connectionId, "connection-1")
    XCTAssertEqual(unreserved?.turns, Self.droppedTurns)

    // Its own reservation is the latest, even though it never went live.
    let transport = FakeTransport()
    let unanswered = LiveCall(
      conversation: .fixture(),
      client: FakeServer(reservations: [
        .ready(.fixture(connectionId: "reconnect", continuesCall: true))
      ]).client(transport),
      soFar: first.soFar)
    await unanswered.start()
    transport.onEvent?(.closed)
    XCTAssertEqual(unanswered.dropped, .init(reason: nil, retry: .callAgain))

    let reserved = await unanswered.finish()
    XCTAssertEqual(reserved?.connectionId, "reconnect")
    XCTAssertEqual(reserved?.turns, Self.droppedTurns)
    XCTAssertEqual(reserved?.spokenSeconds, 2)
  }

  func testCancellingAReconnectWhileItRingsLeavesTheCallDropped() async {
    let first = await droppedCall()
    let reconnect = LiveCall(
      conversation: .fixture(), client: FakeServer(continuesCall: true).client(FakeTransport()),
      soFar: first.soFar)

    await reconnect.start()
    reconnect.cancel()

    XCTAssertEqual(reconnect.dropped, .init(reason: nil, retry: .callAgain))

    // A new call has nothing to save: the screen takes it back to its intro.
    let new = LiveCall(conversation: .fixture(), client: FakeServer().client(FakeTransport()))

    await new.start()
    new.cancel()

    XCTAssertNil(new.dropped)
    XCTAssertNil(new.soFar.connectionId)
  }

  func testAReservationAnsweringAfterTheCancelIsTheConnectionTheCallSavesUnder() async {
    let first = await droppedCall()
    // Even one that would have opened a new call: it never went live, so the call stays dropped.
    let server = FakeServer(
      reservations: [.ready(.fixture(connectionId: "late", continuesCall: false))],
      holdsConnects: true)
    let reconnect = LiveCall(
      conversation: .fixture(), client: server.client(FakeTransport()), soFar: first.soFar)

    Task { await reconnect.start() }
    await settle { server.isHoldingConnect }
    reconnect.cancel()
    XCTAssertEqual(reconnect.dropped, .init(reason: nil, retry: .callAgain))

    let finishing = Task { await reconnect.finish() }
    try? await Task.sleep(for: .milliseconds(50))
    server.answerConnect()
    let summary = await finishing.value

    XCTAssertEqual(summary?.connectionId, "late")
    XCTAssertEqual(summary?.turns, Self.droppedTurns)
    XCTAssertEqual(reconnect.dropped, .init(reason: nil, retry: .callAgain))
    XCTAssertEqual(server.ended, ["late"])

    // Called again and refused: the call still saves under the late connection.
    let refused = LiveCall(
      conversation: .fixture(),
      client: FakeServer(reservations: [.callsPaused]).client(FakeTransport()),
      soFar: reconnect.soFar)
    await refused.start()

    let saved = await refused.finish()
    XCTAssertEqual(saved?.connectionId, "late")
    XCTAssertEqual(saved?.turns, Self.droppedTurns)
  }

  func testADroppedCallSaysWhyItsReconnectCantGoOnAndHowToGetBackIn() {
    let shown: [(LiveCall.Failure, DroppedCall)] = [
      // Also a reconnect the learner cancelled while it rang.
      (.connect, .init(reason: nil, retry: .callAgain)),
      (.dropped, .init(reason: nil, retry: .callAgain)),
      (.callsPaused, .init(reason: .callsPaused, retry: .callAgain)),
      (.callInProgress, .init(reason: .callInProgress, retry: .takeover)),
      (.limit, .init(reason: .limit, retry: nil)),
      (.plusRequired, .init(reason: .plusRequired, retry: nil)),
      (.ended, .init(reason: .ended, retry: nil)),
    ]

    for (failure, dropped) in shown {
      XCTAssertEqual(
        DroppedCall(continuing: true, phase: .failed, failure: failure, micBlocked: false),
        dropped, "\(failure)")
    }

    XCTAssertEqual(
      DroppedCall(continuing: true, phase: .idle, failure: nil, micBlocked: true),
      .init(reason: .microphone, retry: .microphone))
    // Typing instead keeps the microphone blocked: what stopped the typed reconnect is why.
    XCTAssertEqual(
      DroppedCall(continuing: true, phase: .failed, failure: .limit, micBlocked: true),
      .init(reason: .limit, retry: nil))
  }

  func testWithoutADroppedCallToSaveOnlyACallThatWentLiveShowsAsDropped() {
    XCTAssertEqual(
      DroppedCall(continuing: false, phase: .failed, failure: .dropped, micBlocked: false),
      .init(reason: nil, retry: .callAgain))
    XCTAssertNil(
      DroppedCall(continuing: false, phase: .failed, failure: .connect, micBlocked: false))
    XCTAssertNil(DroppedCall(continuing: false, phase: .idle, failure: nil, micBlocked: true))
    // A reconnect still on its way isn't stopped.
    XCTAssertNil(DroppedCall(continuing: true, phase: .connecting, failure: nil, micBlocked: true))
  }

  func testHelpUsedBeforeTheSetupCountsForTheNewCall() async {
    let call = LiveCall(conversation: .fixture(), client: FakeServer().client(FakeTransport()))

    call.useHelp()
    await call.start()

    XCTAssertTrue(call.usedHelp)
  }

  func testAnExamCueComesDueOnceAndOnlyTheLatestAfterADrop() {
    let times = [60, 120, 240]

    XCTAssertNil(LiveCall.examCueDue(at: 59, times: times, sent: 0))
    XCTAssertEqual(LiveCall.examCueDue(at: 60, times: times, sent: 0), 0)
    XCTAssertNil(LiveCall.examCueDue(at: 100, times: times, sent: 1))
    // Back after a drop at 250 s: the 120 s cue is stale, and only the 240 s one goes out.
    XCTAssertEqual(LiveCall.examCueDue(at: 250, times: times, sent: 1), 2)
    XCTAssertNil(LiveCall.examCueDue(at: 400, times: times, sent: 3))
  }

  // MARK: The ending, on a fake clock: a 2-minute call that the server hangs up 45 s later.

  func testAtTheTalkTimeALearnerAnsweringGetsTheGoodbyeCueAtOnce() {
    var run = EndingRun()
    run.chat(until: 110)
    run.learnerTalks(from: 115, to: 125)
    run.wait(until: 130)

    assertTimes(run.times(of: .goodbye), [120], accuracy: 0.11)
  }

  func testOnlyAGoodbyeWhileTheLearnerTalksGoesAsQuietContext() {
    var talking = EndingRun()
    talking.chat(until: 110)
    talking.learnerTalks(from: 115, to: 125)
    talking.wait(until: 126)

    var idle = EndingRun()
    idle.chat(until: 110)
    idle.characterTalks(from: 117, to: 120)
    idle.wait(until: 135)

    XCTAssertEqual(talking.goodbyesWhileLearnerSpeaks, [true])
    XCTAssertEqual(idle.goodbyesWhileLearnerSpeaks, [false])
  }

  func testACheckWaitsForTheCharacterToAnswerTheLearner() {
    var timing = ObjectiveCheckTiming()
    timing.hear(.character, startMs: 0)
    XCTAssertFalse(timing.isDue)

    timing.hear(.learner, startMs: 1000)
    XCTAssertFalse(timing.isDue)

    timing.hear(.character, startMs: 3000)
    // Their late words started before the answer: the character still spoke last.
    timing.hear(.learner, startMs: 2500)
    XCTAssertTrue(timing.isDue)

    timing.read()
    XCTAssertFalse(timing.isDue)

    // A typed reply has no session time: it's the latest words.
    timing.hear(.learner, startMs: nil)
    XCTAssertFalse(timing.isDue)
  }

  func testAtTheTalkTimeTheCharacterFinishesFirst() {
    var run = EndingRun()
    run.chat(until: 110)
    run.characterTalks(from: 118, to: 123)
    run.learnerTalks(from: 126, to: 128)
    run.wait(until: 135)

    assertTimes(run.times(of: .goodbye), [126], accuracy: 0.11)
  }

  func testAQuietLearnerGetsAWhileToAnswerBeforeTheGoodbye() {
    var run = EndingRun()
    run.chat(until: 110)
    run.characterTalks(from: 117, to: 120)
    run.wait(until: 135)

    // The character stops counting as talking 1.5 s after its last words, then 8 s pass.
    assertTimes(run.times(of: .goodbye), [129.5], accuracy: 0.11)
  }

  func testAGoodbyeCueSentDuringALongAnswerIsntSentAgainBeforeTheLearnerStops() {
    var run = EndingRun()
    run.chat(until: 110)
    run.learnerTalks(from: 119, to: 140)
    run.wait(until: 160)

    let sent = run.times(of: .goodbye)
    XCTAssertEqual(sent.count, 2)
    XCTAssertEqual(sent.first ?? 0, 120, accuracy: 0.11)
    XCTAssertGreaterThanOrEqual(sent.last ?? 0, 147.8)
  }

  func testTheCallHangsUpOnceTheGoodbyeIsFollowedByQuiet() {
    var run = EndingRun()
    run.chat(until: 110)
    run.learnerTalks(from: 115, to: 121)
    run.acknowledge(at: 121.5)
    run.characterTalks(from: 122.5, to: 125)
    run.wait(until: 140)

    XCTAssertEqual(run.hangUp?.reason, .time)
    XCTAssertEqual(run.hangUp?.at ?? 0, 128, accuracy: 0.11)
  }

  func testTheCallWaitsWhileTheLearnerKeepsTalkingOrTypingAfterTheGoodbye() {
    var run = EndingRun()
    run.chat(until: 110)
    run.learnerTalks(from: 115, to: 121)
    run.acknowledge(at: 121.5)
    run.characterTalks(from: 122.5, to: 125)
    run.microphoneHears(from: 126, to: 140)

    for second in stride(from: 128.0, through: 140, by: 2) {
      run.learnerHeard(at: second)
    }

    run.learnerTypes(at: 142)
    run.wait(until: 150)

    XCTAssertEqual(run.hangUp?.at ?? 0, 145, accuracy: 0.11)
  }

  func testAfterTheGoodbyeANoisyRoomHoldsTheCallOnlyUntilTheAnswerWait() {
    var run = EndingRun(talk: 5)
    run.characterTalks(from: 0.5, to: 2.3)
    run.microphoneHears(from: 9, to: 70)
    run.acknowledge(at: 13)
    run.characterTalks(from: 13.2, to: 15)
    run.wait(until: 60)

    // The goodbye's last words came at 15 s; only noise followed them.
    XCTAssertEqual(run.hangUp?.reason, .time)
    XCTAssertEqual(run.hangUp?.at ?? 0, 23, accuracy: 0.11)
  }

  func testAfterTheGoodbyeTheCallWaitsWhileTheLearnersWordsKeepComingBack() {
    var run = EndingRun(talk: 5)
    run.characterTalks(from: 0.5, to: 2.3)
    run.acknowledge(at: 13)
    run.characterTalks(from: 13.2, to: 15)
    run.microphoneHears(from: 15.5, to: 30)

    for second in stride(from: 17.0, through: 30, by: 1) {
      run.learnerHeard(at: second)
    }

    run.wait(until: 60)

    // Their last words came back at 30 s; the microphone went quiet at 31 s.
    XCTAssertEqual(run.hangUp?.at ?? 0, 34, accuracy: 0.11)
  }

  func testWhenTheLearnerAnswersTheGoodbyeTheQuietWindowStartsAgain() {
    var run = EndingRun()
    run.chat(until: 110)
    run.learnerTalks(from: 115, to: 121)
    run.acknowledge(at: 121.5)
    run.characterTalks(from: 122.5, to: 125)
    run.learnerTalks(from: 126, to: 127.5)
    run.characterTalks(from: 129, to: 131)
    run.wait(until: 140)

    XCTAssertEqual(run.hangUp?.at ?? 0, 134, accuracy: 0.11)
  }

  func testTheHardStopEndsTheCallWhateverIsHappening() {
    var run = EndingRun()
    run.chat(until: 100)
    run.learnerTalks(from: 100, to: 170)

    XCTAssertEqual(run.hangUp?.reason, .some(nil))
    XCTAssertEqual(run.hangUp?.at ?? 0, 165, accuracy: 0.11)
  }

  func testEveryGoalMetEndsWithTheThankYouGoodbye() {
    var run = EndingRun()
    run.chat(until: 50)
    run.characterTalks(from: 55, to: 58)
    run.goalsMet(at: 60)
    run.learnerTalks(from: 62, to: 64)
    run.wait(until: 70)

    assertTimes(run.times(of: .goodbyeDone), [62], accuracy: 0.11)
    XCTAssertTrue(run.times(of: .goodbye).isEmpty)
  }

  func testALearnersOwnGoodbyeEndsTheCallWithoutACue() {
    var run = EndingRun()
    run.chat(until: 30)
    run.learnerTalks(from: 36, to: 38)
    run.characterTalks(from: 40, to: 42)
    run.saidGoodbye(at: 44)
    run.wait(until: 50)

    XCTAssertTrue(run.times(of: .goodbye).isEmpty)
    XCTAssertEqual(run.hangUp?.reason, .goodbye)
    XCTAssertEqual(run.hangUp?.at ?? 0, 45, accuracy: 0.11)
  }

  func testAGoodbyeSaidBeforeTheCueWentOutIsntSaidAgain() {
    var waiting = EndingRun()
    waiting.chat(until: 110)
    waiting.learnerTalks(from: 112, to: 114)
    // The character says goodbye back across the talk time, so the cue waits for it to stop.
    waiting.characterTalks(from: 115, to: 121)
    waiting.saidGoodbye(at: 122)
    waiting.wait(until: 130)

    XCTAssertTrue(waiting.times(of: .goodbye).isEmpty)
    XCTAssertEqual(waiting.hangUp?.reason, .time)
    XCTAssertEqual(waiting.hangUp?.at ?? 0, 124, accuracy: 0.11)

    var sent = EndingRun()
    sent.chat(until: 110)
    sent.learnerTalks(from: 115, to: 121)
    sent.saidGoodbye(at: 122)
    sent.wait(until: 128)

    // The cue already went out: its own goodbye is the one to wait for.
    assertTimes(sent.times(of: .goodbye), [120], accuracy: 0.11)
    XCTAssertNil(sent.hangUp)

    var stale = EndingRun()
    stale.chat(until: 110)
    stale.learnerTalks(from: 112, to: 114)
    stale.characterTalks(from: 115, to: 121)
    // The learner spoke again after the transcript the check read.
    stale.learnerTalks(from: 121.5, to: 122)
    // It answers while the character is still talking, before the cue could go out.
    stale.saidGoodbye(at: 122.2, snapshotAt: 121.2)
    stale.wait(until: 130)

    assertTimes(stale.times(of: .goodbye), [122.5], accuracy: 0.11)
    XCTAssertNil(stale.hangUp)
  }

  func testAQuietLearnerIsCheckedOnOnceThenTheCallSaysGoodbye() {
    var run = EndingRun()
    run.characterTalks(from: 1, to: 3)
    run.wait(until: 15.9)
    XCTAssertFalse(run.isQuietLong)
    run.wait(until: 16.5)
    XCTAssertTrue(run.isQuietLong)

    run.wait(until: 31)
    // The character asking whether they're there doesn't start the silence again.
    run.characterTalks(from: 31, to: 33)
    run.wait(until: 36)
    XCTAssertTrue(run.isQuietLong)
    run.wait(until: 60)

    assertTimes(run.times(of: .checkIn), [29.5], accuracy: 0.11)
    assertTimes(run.times(of: .goodbye), [54.5], accuracy: 0.11)
  }

  func testACoughThatNeverBecomesATranscriptStartsTheQuietAgain() {
    var run = EndingRun()
    run.characterTalks(from: 1, to: 3)
    run.learnerTalks(from: 20, to: 20.2)
    // The microphone goes quiet at 21.2 s.
    run.wait(until: 33.1)
    XCTAssertFalse(run.isQuietLong)
    run.wait(until: 33.3)
    XCTAssertTrue(run.isQuietLong)
    run.wait(until: 75)

    assertTimes(run.times(of: .checkIn), [46.2], accuracy: 0.11)
    assertTimes(run.times(of: .goodbye), [71.2], accuracy: 0.11)
  }

  func testNothingFiresWhileTheLearnerKeepsMakingSound() {
    var run = EndingRun()
    run.characterTalks(from: 1, to: 3)
    run.learnerTalks(from: 5, to: 70)

    XCTAssertFalse(run.isQuietLong)
    XCTAssertTrue(run.times(of: .checkIn).isEmpty)
    XCTAssertTrue(run.times(of: .goodbye).isEmpty)

    // The microphone goes quiet at 71 s.
    run.wait(until: 100)
    assertTimes(run.times(of: .checkIn), [96], accuracy: 0.11)
  }

  func testACoughAfterTheCheckInStartsAStretchWithItsOwnCheckIn() {
    var run = EndingRun()
    run.characterTalks(from: 1, to: 3)
    run.wait(until: 31)
    run.characterTalks(from: 31, to: 33)
    run.learnerTalks(from: 40, to: 40.2)
    run.wait(until: 95)

    assertTimes(run.times(of: .checkIn), [29.5, 66.2], accuracy: 0.11)
    assertTimes(run.times(of: .goodbye), [91.2], accuracy: 0.11)
  }

  func testTheQuietStartsWhenTheLastSoundStops() {
    var finishing = EndingRun()
    finishing.characterTalks(from: 1, to: 3)
    finishing.learnerTalks(from: 4, to: 6.4)
    finishing.characterTalks(from: 6.5, to: 7.5)
    // The learner finishes after the reply: their microphone goes quiet at 9.4 s, after the
    // character stopped at 9 s.
    finishing.learnerTalks(from: 7.6, to: 8.4)
    finishing.wait(until: 40)

    assertTimes(finishing.times(of: .checkIn), [34.4], accuracy: 0.11)

    var heard = EndingRun()
    heard.characterTalks(from: 1, to: 3)
    heard.learnerTalks(from: 4, to: 6.4)
    heard.characterTalks(from: 6.5, to: 7.5)
    // Their transcript comes back during the reply: the quiet starts once the character stops.
    heard.learnerHeard(at: 8.2)
    heard.wait(until: 40)

    assertTimes(heard.times(of: .checkIn), [34], accuracy: 0.11)
  }

  func testTypingStartsTheQuietAgain() {
    var run = EndingRun()
    run.characterTalks(from: 1, to: 3)
    run.learnerTypes(at: 20)
    run.wait(until: 60)

    assertTimes(run.times(of: .checkIn), [45], accuracy: 0.11)
  }

  func testNoCheckInOnceTheEndingStarted() {
    var run = EndingRun(talk: 20, hardStop: 65)
    run.characterTalks(from: 1, to: 3)
    run.wait(until: 60)

    XCTAssertTrue(run.times(of: .checkIn).isEmpty)
    assertTimes(run.times(of: .goodbye), [20, 28], accuracy: 0.11)
  }

  func testTheOpeningIsSentAgainOnlyOnceTakenInAndUnanswered() {
    var slow = EndingRun()
    slow.wait(until: 10)
    XCTAssertTrue(slow.times(of: .opening).isEmpty)

    var silent = EndingRun()
    silent.acknowledgeOpening(at: 0.8)
    silent.wait(until: 10)
    assertTimes(silent.times(of: .opening), [5.8], accuracy: 0.11)

    var answered = EndingRun()
    answered.acknowledgeOpening(at: 0.8)
    answered.characterTalks(from: 2, to: 4)
    answered.wait(until: 10)
    XCTAssertTrue(answered.times(of: .opening).isEmpty)
  }

  func testAReplyTypedAtTheTalkTimeIsAnsweredBeforeTheGoodbye() {
    var run = EndingRun()
    run.chat(until: 110)
    run.learnerComposes(from: 115, to: 120.9)
    run.learnerSends(at: 121)
    run.characterTalks(from: 122.5, to: 124)
    run.wait(until: 130)

    // Composing and then the reply hold the cue until the character answered and stopped.
    assertTimes(run.times(of: .goodbye), [125.5], accuracy: 0.11)
  }

  func testWordsJustBeforeTheAcknowledgmentAreTheGoodbye() {
    var run = EndingRun()
    run.chat(until: 110)
    run.learnerTalks(from: 115, to: 120.2)
    run.characterTalks(from: 121, to: 121.25)
    run.acknowledge(at: 121.4, startMs: 121_200)
    run.wait(until: 130)

    // Nothing came after the acknowledgment: only the words before it can be the goodbye.
    XCTAssertEqual(run.hangUp?.reason, .time)
    XCTAssertEqual(run.hangUp?.at ?? 0, 124.25, accuracy: 0.11)
  }

  func testWordsFromBeforeTheCueArentTheGoodbye() {
    var run = EndingRun()
    run.chat(until: 110)
    run.learnerTalks(from: 115, to: 121)
    run.characterSpeaks(at: 121.2, startMs: 118_000)
    run.acknowledge(at: 121.5, startMs: 121_500)
    run.wait(until: 135)

    XCTAssertNil(run.hangUp)
    XCTAssertEqual(run.times(of: .goodbye).count, 2)
  }

  func testTheLearnersOwnTranscriptStartsTheQuietAgain() {
    var run = EndingRun()
    run.characterTalks(from: 1, to: 3)
    run.learnerTalks(from: 5, to: 6)
    run.characterTalks(from: 6.5, to: 7)
    // It arrives after the character stopped, at 8.5 s, so the quiet starts from it.
    run.learnerHeard(at: 9)
    run.wait(until: 40)

    assertTimes(run.times(of: .checkIn), [34], accuracy: 0.11)
  }

  func testTheLearnersTranscriptCountsAsSpeakingWhenTheMicrophoneMissedIt() {
    var run = EndingRun()
    run.chat(until: 110)
    run.characterTalks(from: 117, to: 118.5)
    run.learnerHeard(at: 121)
    run.wait(until: 125)

    assertTimes(run.times(of: .goodbye), [121], accuracy: 0.11)
  }

  func testReplyGapsSkipTurnsACueAnsweredAndCountUnansweredOnes() {
    func at(_ seconds: TimeInterval) -> Date {
      Date(timeIntervalSinceReferenceDate: seconds)
    }

    var gaps = LiveCallReplyGaps()
    gaps.learnerSpoke(at: at(1))
    gaps.learnerSpoke(at: at(2))
    gaps.characterSpoke(at: at(4.5))
    // A cue during a turn covers the answer even after the learner paused and went on.
    gaps.learnerSpoke(at: at(6))
    gaps.cueSent()
    gaps.learnerSpoke(at: at(7))
    gaps.learnerSpoke(at: at(8.5))
    gaps.characterSpoke(at: at(11))
    gaps.learnerSpoke(at: at(13))
    gaps.learnerSpoke(at: at(20))
    gaps.callEnded()

    XCTAssertEqual(gaps.gaps, [2.5])
    XCTAssertEqual(gaps.medianMs, 2500)
    XCTAssertEqual(gaps.unansweredTurns, 2)
  }

  func testATypedReplyAfterTheTalkTimeWaitsForItsAnswerOverALateTranscript() {
    var run = EndingRun(talk: 20, hardStop: 65)
    run.characterTalks(from: 15, to: 18)
    run.learnerComposes(from: 19.5, to: 21)
    run.learnerSends(at: 21.1)
    run.learnerHeard(at: 21.4)
    run.wait(until: 35)

    // Unanswered, the reply holds the goodbye until the answer wait passes.
    assertTimes(run.times(of: .goodbye), [29.1], accuracy: 0.11)
  }

  func testTheTalkTimeEndingStartsBeforeTheOpeningIsSentAgain() {
    var run = EndingRun(talk: 5, hardStop: 50)
    run.acknowledgeOpening(at: 0)
    run.wait(until: 10)

    XCTAssertTrue(run.times(of: .opening).isEmpty)
    assertTimes(run.times(of: .goodbye), [8], accuracy: 0.11)
  }

  func testReplyGapsCountAFastReplyAndATurnTheHangUpCutOff() {
    func at(_ seconds: TimeInterval) -> Date {
      Date(timeIntervalSinceReferenceDate: seconds)
    }

    var fast = LiveCallReplyGaps()
    fast.learnerSpoke(at: at(1.6))
    fast.learnerSpoke(at: at(1.8))
    fast.learnerSpoke(at: at(2))
    fast.characterSpoke(at: at(2.6))
    fast.callEnded()

    XCTAssertEqual(fast.medianMs, 600)
    XCTAssertEqual(fast.unansweredTurns, 0)

    var cutOff = LiveCallReplyGaps()
    cutOff.learnerSpoke(at: at(9.6))
    cutOff.learnerSpoke(at: at(9.8))
    cutOff.callEnded()

    XCTAssertEqual(cutOff.unansweredTurns, 1)
  }

  func testTheFirstWordsAfterAPauseGetASpace() {
    let turns = [TranscriptTurn]()
      .adding("Is it available?", speaker: .character, startMs: 0, endMs: 900)
      .adding("Yes", speaker: .character, startMs: 2500, endMs: 2800)
      .adding(" it is.", speaker: .character, startMs: 2800, endMs: 3200)

    XCTAssertEqual(turns.last?.text, "Is it available? Yes it is.")
  }

  private func event(_ json: String) -> LiveServerEvent? {
    LiveServerEvent(json: Data(json.utf8))
  }

  private func object(_ data: Data) throws -> [String: Any] {
    try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
  }

  private func refusal(_ status: Int, _ code: String, _ details: String? = nil) -> VoiceRefusal {
    VoiceRefusal(
      status: status, code: code,
      details: details.flatMap {
        try? JSONDecoder().decode(OpenAPIValueContainer.self, from: Data($0.utf8))
      })
  }

  private func reservation(_ status: Int, _ code: String, _ details: String? = nil)
    -> CallReservation
  {
    CallReservation(refusal: refusal(status, code, details))
  }

  private static let droppedTurns: [ConversationTurn] = [
    .init(speaker: .character, text: "Hi!"), .init(speaker: .learner, text: "Hello"),
    .init(speaker: .character, text: "How are you?"),
  ]

  /// Went live on connection-1, said `droppedTurns`, then lost its connection.
  private func droppedCall() async -> LiveCall {
    let transport = FakeTransport()
    let call = LiveCall(conversation: .fixture(), client: FakeServer().client(transport))

    await call.start()
    transport.onEvent?(.started)
    transport.onEvent?(.transcript(speaker: .character, delta: "Hi!", startMs: 0, endMs: 500))
    transport.onEvent?(.transcript(speaker: .learner, delta: "Hello", startMs: 1000, endMs: 3000))
    transport.onEvent?(
      .transcript(speaker: .character, delta: " How are you?", startMs: 3500, endMs: 4000))
    transport.onLost?()
    await settle { call.phase == .failed }

    return call
  }

  private func settle(until condition: () -> Bool) async {
    for _ in 0..<100 where !condition() {
      await Task.yield()
      try? await Task.sleep(for: .milliseconds(5))
    }
  }

  /// For the call's own clocks, which run on real time.
  private func waitUpTo(_ seconds: Double, until condition: () -> Bool) async {
    let end = Date.now.addingTimeInterval(seconds)

    while !condition(), Date.now < end {
      try? await Task.sleep(for: .milliseconds(50))
    }
  }
}

@MainActor
private final class FakeTransport: LiveCallTransport {
  var onEvent: ((LiveServerEvent) -> Void)?
  var onLost: (() -> Void)?
  private(set) var offers = 0
  private(set) var sent: [LiveClientCommand] = []
  private(set) var isSilenced = false
  private(set) var isClosed = false
  /// What the microphone hears at every reading.
  var speaking = false
  private let holdsOffer: Bool
  private var offerWait: CheckedContinuation<Void, any Error>?

  /// `holdsOffer`: ICE gathering never finishes, and only closing ends the wait, as in WebRTC.
  init(holdsOffer: Bool = false) {
    self.holdsOffer = holdsOffer
  }

  var isWaitingForOffer: Bool {
    offerWait != nil
  }

  func makeOffer() async throws -> String {
    offers += 1

    if holdsOffer {
      try await withCheckedThrowingContinuation { offerWait = $0 }
    }

    return "offer"
  }

  func accept(answer: String) async throws {}

  func send(_ command: LiveClientCommand) {
    sent.append(command)
  }

  func hearsSpeech() async -> Bool {
    speaking
  }

  /// Every cue sent with this event id prefix.
  func cues(_ prefix: String) -> [LiveCallCue] {
    sent.compactMap { command in
      guard case .append(let cue, _, let eventId?) = command, eventId.hasPrefix(prefix) else {
        return nil
      }

      return cue
    }
  }

  func silence() {
    isSilenced = true
  }

  func close() {
    isClosed = true
    offerWait?.resume(throwing: CancellationError())
    offerWait = nil
  }
}

@MainActor
private final class FakeServer {
  private var reservations: [CallReservation?]
  private let endedAtDeadline: Bool
  private let confirmsHangup: Bool
  private let microphone: Bool
  private let talkSeconds: Int
  private let continuesCall: Bool
  private(set) var connects = 0
  /// Whether each reservation asked to end the learner's other call.
  private(set) var takeovers: [Bool] = []
  private(set) var checks = 0
  private let holdsChecks: Bool
  private var pendingCheck: CheckedContinuation<ObjectiveCheck?, Never>?
  private let holdsConnects: Bool
  private var pendingConnect: CheckedContinuation<Void, Never>?
  private(set) var microphoneRequests = 0
  private(set) var redeemed: [String] = []
  /// The earlier turns each redeem sent.
  private(set) var redeemedTurns: [[ConversationTurn]] = []
  private(set) var ended: [String] = []

  init(
    reservations: [CallReservation?] = [], endedAtDeadline: Bool = false,
    confirmsHangup: Bool = true, microphone: Bool = true, talkSeconds: Int = 120,
    continuesCall: Bool = false, holdsChecks: Bool = false, holdsConnects: Bool = false
  ) {
    self.continuesCall = continuesCall
    self.holdsChecks = holdsChecks
    self.holdsConnects = holdsConnects
    self.reservations = reservations
    self.endedAtDeadline = endedAtDeadline
    self.confirmsHangup = confirmsHangup
    self.microphone = microphone
    self.talkSeconds = talkSeconds
  }

  /// `holdsChecks`: the check running answers now.
  func answerCheck(_ check: ObjectiveCheck) {
    pendingCheck?.resume(returning: check)
    pendingCheck = nil
  }

  var isHoldingConnect: Bool {
    pendingConnect != nil
  }

  /// `holdsConnects`: the reservation on its way answers now.
  func answerConnect() {
    pendingConnect?.resume()
    pendingConnect = nil
  }

  func client(_ transport: FakeTransport) -> LiveCallClient {
    LiveCallClient(
      connect: { takeover in
        self.connects += 1
        self.takeovers.append(takeover)

        if self.holdsConnects {
          await withCheckedContinuation { self.pendingConnect = $0 }
        }

        let next = self.reservations.isEmpty ? nil : self.reservations.removeFirst()
        return next
          ?? .ready(
            .fixture(
              connectionId: "connection-\(self.connects)", talkSeconds: self.talkSeconds,
              continuesCall: self.continuesCall))
      },
      redeem: { connectionId, _, turns in
        self.redeemed.append(connectionId)
        self.redeemedTurns.append(turns)
        return "answer"
      },
      end: { connectionId in
        self.ended.append(connectionId)
        return self.confirmsHangup ? self.endedAtDeadline : nil
      },
      checkObjectives: { _ in
        self.checks += 1

        guard self.holdsChecks else {
          return nil
        }

        let check = await withCheckedContinuation { self.pendingCheck = $0 }
        // As the app's cache does: a write whose task was cancelled has no answer.
        return Task.isCancelled ? nil : check
      },
      makeTransport: { transport },
      requestMicrophone: {
        self.microphoneRequests += 1
        return self.microphone
      })
  }
}

extension Components.Schemas.LanguageConversationSetup {
  fileprivate static func fixture(
    connectionId: String, talkSeconds: Int = 120, continuesCall: Bool = false
  ) -> Self {
    func cue(_ channel: LiveCallCue.ChannelPayload, _ text: String) -> LiveCallCue {
      .init(channel: channel, text: text)
    }

    return .init(
      connectionId: connectionId, continuesCall: continuesCall,
      deadlineAt: .now.addingTimeInterval(165),
      script: .init(
        cues: .init(
          checkIn: cue(.commentary, "Ask if they're there."),
          goodbye: cue(.commentary, "Say goodbye."),
          goodbyeDone: cue(.commentary, "Thank them and say goodbye."),
          noBackend: cue(.thinking, "Answer yourself."), opening: cue(.commentary, "Greet them."),
          typedReply: cue(.commentary, "They typed: ")),
        timing: .fixture),
      seconds: talkSeconds + 45, sessionUrl: "/sdp", talkSeconds: talkSeconds, voice: "marin")
  }
}

extension LiveCallEnding.Timing {
  fileprivate static let fixture = Self(
    answerWaitMs: 8000, characterQuietMs: 1500, checkInMs: 25000, goodbyeQuietMs: 3000,
    goodbyeRetryMs: 8000, openingRetryMs: 5000, quietGoodbyeMs: 50000, quietHintMs: 12000)
}

extension LanguageConversation {
  fileprivate static func fixture() -> Self {
    .init(
      character: .init(name: "Ana", place: "Toronto", role: "Landlord"),
      exam: nil, examTask: nil, goalId: nil,
      hints: ["Is it available?"], id: "conversation-1", kind: .practice, level: .a2, locked: false,
      minutes: 2,
      objectives: [.init(description: "Ask if it's free", label: "Is it free?", met: false)],
      openingLine: "Hello, how can I help?", result: nil, situation: "Renting a flat",
      status: .ready, targetLanguage: "en", title: "Renting", unit: nil)
  }
}

/// The ending's rules on a clock that steps in 100 ms ticks, as a call's does.
private struct EndingRun {
  private static let start = Date(timeIntervalSinceReferenceDate: 1_000)

  private var ending: LiveCallEnding
  private var now: TimeInterval = 0
  private var log: [(at: TimeInterval, action: LiveCallEnding.Action)] = []
  private var microphone: ClosedRange<TimeInterval>?

  init(talk: TimeInterval = 120, hardStop: TimeInterval = 165) {
    ending = LiveCallEnding(
      timing: .fixture,
      liveAt: Self.start, talkEndsAt: Self.start.addingTimeInterval(talk),
      hardStopAt: Self.start.addingTimeInterval(hardStop))
  }

  var isQuietLong: Bool {
    ending.isQuietLong(at: date(now))
  }

  var hangUp: (at: TimeInterval, reason: LiveCallEnding.Reason?)? {
    for entry in log {
      if case .hangUp(let reason) = entry.action {
        return (entry.at, reason)
      }
    }

    return nil
  }

  /// Whether each goodbye went while the learner was talking.
  var goodbyesWhileLearnerSpeaks: [Bool] {
    log.compactMap { entry in
      guard case .send(.goodbye, let whileLearnerSpeaks) = entry.action else { return nil }
      return whileLearnerSpeaks
    }
  }

  func times(of cue: LiveCallEnding.Cue) -> [TimeInterval] {
    log.compactMap { entry in
      guard case .send(cue, _) = entry.action else { return nil }
      return entry.at
    }
  }

  mutating func wait(until seconds: TimeInterval) {
    while now < seconds - 0.0001 {
      now = min(seconds, now + 0.1)

      if microphone?.contains(now) == true {
        ending.learnerSpoke(at: date(now))
      }

      advance()
    }
  }

  /// The microphone stays above the speech threshold from `start` through `end`, a learner talking
  /// or a noisy room, while the rest of the timeline plays.
  mutating func microphoneHears(from start: TimeInterval, to end: TimeInterval) {
    microphone = start...end
  }

  /// Every 10 s the character talks for 3 s, and the learner answers for 2 s.
  mutating func chat(until end: TimeInterval) {
    for start in stride(from: 0.0, to: end, by: 10) {
      characterTalks(from: start + 1, to: start + 4)
      learnerTalks(from: start + 5, to: start + 7)
    }
  }

  /// Fragments a few times a second, each placed on the session's timeline when it arrives.
  mutating func characterTalks(from start: TimeInterval, to end: TimeInterval) {
    every(0.25, from: start, to: end) { ending, at in
      ending.characterSpoke(at: Self.start.addingTimeInterval(at), startMs: at * 1000)
    }
  }

  /// The microphone above the speech threshold at each 200 ms reading.
  mutating func learnerTalks(from start: TimeInterval, to end: TimeInterval) {
    every(0.2, from: start, to: end) { ending, at in
      ending.learnerSpoke(at: Self.start.addingTimeInterval(at))
    }
  }

  /// One key typed in the reply field.
  mutating func learnerTypes(at seconds: TimeInterval) {
    once(at: seconds) { $0.learnerTyped(at: $1) }
  }

  /// A reply being typed, a few keys a second.
  mutating func learnerComposes(from start: TimeInterval, to end: TimeInterval) {
    every(0.3, from: start, to: end) { ending, at in
      ending.learnerTyped(at: Self.start.addingTimeInterval(at))
    }
  }

  mutating func learnerSends(at seconds: TimeInterval) {
    once(at: seconds) { $0.learnerSent(at: $1) }
  }

  /// The learner's own words came back as a transcript.
  mutating func learnerHeard(at seconds: TimeInterval) {
    once(at: seconds) { $0.learnerHeard(at: $1) }
  }

  mutating func characterSpeaks(at seconds: TimeInterval, startMs: Double) {
    once(at: seconds) { $0.characterSpoke(at: $1, startMs: startMs) }
  }

  mutating func acknowledgeOpening(at seconds: TimeInterval) {
    once(at: seconds) { $0.openingAcknowledged(at: $1) }
  }

  /// A goodbye cue taken into the session's timeline, by default where it arrived.
  mutating func acknowledge(at seconds: TimeInterval, startMs: Double? = nil) {
    once(at: seconds) { ending, _ in
      ending.goodbyeAcknowledged(startMs: startMs ?? seconds * 1000)
    }
  }

  /// An objective check found every goal met in the transcript as it was when the check returned.
  mutating func goalsMet(at seconds: TimeInterval) {
    once(at: seconds) {
      _ = $0.checked(at: $1, snapshotAt: $1, goodbye: false, allGoalsMet: true)
    }
  }

  /// An objective check found a mutual goodbye in the transcript as it was at `snapshotAt`.
  mutating func saidGoodbye(at seconds: TimeInterval, snapshotAt: TimeInterval? = nil) {
    once(at: seconds) { ending, now in
      let snapshot = Self.start.addingTimeInterval(snapshotAt ?? seconds)
      _ = ending.checked(at: now, snapshotAt: snapshot, goodbye: true, allGoalsMet: false)
    }
  }

  private mutating func once(
    at seconds: TimeInterval, _ event: (inout LiveCallEnding, Date) -> Void
  ) {
    wait(until: seconds)
    event(&ending, date(seconds))
    advance()
  }

  private mutating func every(
    _ step: TimeInterval, from start: TimeInterval, to end: TimeInterval,
    _ event: (inout LiveCallEnding, TimeInterval) -> Void
  ) {
    var at = start

    while at <= end + 0.0001 {
      wait(until: at)
      event(&ending, at)
      advance()
      at += step
    }
  }

  private mutating func advance() {
    for action in ending.advance(to: date(now)) {
      log.append((now, action))
    }
  }

  private func date(_ seconds: TimeInterval) -> Date {
    Self.start.addingTimeInterval(seconds)
  }
}

private func assertTimes(
  _ actual: [TimeInterval], _ expected: [TimeInterval], accuracy: TimeInterval,
  file: StaticString = #filePath, line: UInt = #line
) {
  XCTAssertEqual(actual.count, expected.count, "\(actual)", file: file, line: line)

  for (actual, expected) in zip(actual, expected) {
    XCTAssertEqual(actual, expected, accuracy: accuracy, "\(actual)", file: file, line: line)
  }
}
