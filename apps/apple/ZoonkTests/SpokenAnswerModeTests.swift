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
    XCTAssertEqual(mode(micBlocked: true), .type)
    XCTAssertEqual(mode(canListen: true, micBlocked: true), .type)
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
    cantListen: Bool = false, micBlocked: Bool = false,
    lockedAnswer: LessonAnswer? = nil, heard: SpokenHeard? = nil
  ) -> SpokenAnswerMode {
    SpokenAnswerMode(
      canListen: canListen, canSpeak: canSpeak, cantTalk: cantTalk, cantListen: cantListen,
      micBlocked: micBlocked, lockedAnswer: lockedAnswer, heard: heard)
  }
}
