import XCTest

@testable import Zoonk

final class SpokenAnswerModeTests: XCTestCase {
  func testSpeakingIsTheDefault() {
    XCTAssertEqual(mode(), .speak)
  }

  func testCantTalkPlaysTheListeningVersionOrTyping() {
    XCTAssertEqual(mode(canListen: true, cantTalk: true), .listen)
    XCTAssertEqual(mode(cantTalk: true), .type)
  }

  func testCantTalkOrListenTypesTheSentence() {
    XCTAssertEqual(mode(canListen: true, cantTalk: true, cantListen: true), .type)
    XCTAssertEqual(mode(canListen: true, canSpeak: false, cantListen: true), .type)
    XCTAssertEqual(mode(canListen: true, cantListen: true), .speak, "speaking needs no listening")
  }

  func testABlockedMicrophoneTypesTheSentence() {
    XCTAssertEqual(mode(microphoneProblem: .denied), .type)
    XCTAssertEqual(mode(canListen: true, microphoneProblem: .denied), .type)
  }

  func testAnUnavailableMicrophoneTypesTheSentence() {
    XCTAssertEqual(mode(microphoneProblem: .unavailable), .type)
    XCTAssertEqual(mode(canListen: true, microphoneProblem: .unavailable), .type)
  }

  func testNoRecorderStillLeavesAWayToAnswer() {
    XCTAssertEqual(mode(canListen: true, canSpeak: false), .listen)
    XCTAssertEqual(mode(canSpeak: false), .type)
  }

  func testAnAnsweredScreenShowsTheWayItWasAnswered() {
    XCTAssertEqual(mode(lockedAnswer: .spokenAnswer(text: "Hola")), .type)
    XCTAssertEqual(
      mode(canListen: true, lockedAnswer: .listening(arrangedWords: ["Hola"])), .listen)
    XCTAssertEqual(
      mode(canListen: true, cantTalk: true, heard: SpokenHeard(words: [], wordsToPractice: [])),
      .speak)
  }

  private func mode(
    canListen: Bool = false, canSpeak: Bool = true, cantTalk: Bool = false,
    cantListen: Bool = false, microphoneProblem: MicrophoneProblem? = nil,
    lockedAnswer: LessonAnswer? = nil, heard: SpokenHeard? = nil
  ) -> SpokenAnswerMode {
    SpokenAnswerMode(
      canListen: canListen, canSpeak: canSpeak, cantTalk: cantTalk, cantListen: cantListen,
      microphoneProblem: microphoneProblem, lockedAnswer: lockedAnswer, heard: heard)
  }
}
