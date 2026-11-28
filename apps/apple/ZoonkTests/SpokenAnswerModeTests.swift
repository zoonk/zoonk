import XCTest

@testable import Zoonk

final class SpokenAnswerModeTests: XCTestCase {
  func testSpeakingIsTheDefault() {
    XCTAssertEqual(mode(), .speak)
    XCTAssertEqual(mode(canListen: true, cantListen: true), .speak, "speaking needs no listening")
  }

  func testCantTalkPlaysTheListeningVersion() {
    XCTAssertEqual(mode(canListen: true, cantTalk: true), .listen)
    XCTAssertEqual(mode(canListen: true, canSpeak: false), .listen)
  }

  func testAScreenThatCantBeSaidOrListenedToIsNeverTyped() {
    XCTAssertEqual(mode(cantTalk: true), .cantAnswer)
    XCTAssertEqual(mode(canSpeak: false), .cantAnswer)
    XCTAssertEqual(mode(canListen: true, cantTalk: true, cantListen: true), .cantAnswer)
    XCTAssertEqual(mode(canListen: true, canSpeak: false, cantListen: true), .cantAnswer)
  }

  func testAnAnsweredScreenShowsTheWayItWasAnswered() {
    XCTAssertEqual(mode(cantTalk: true, lockedAnswer: .spokenAnswer(text: "Hola")), .typed)
    XCTAssertEqual(
      mode(canListen: true, lockedAnswer: .listening(arrangedWords: ["Hola"])), .listen)
    XCTAssertEqual(
      mode(canListen: true, cantTalk: true, heard: SpokenHeard(words: [], wordsToPractice: [])),
      .speak)
  }

  private func mode(
    canListen: Bool = false, canSpeak: Bool = true, cantTalk: Bool = false,
    cantListen: Bool = false, lockedAnswer: LessonAnswer? = nil, heard: SpokenHeard? = nil
  ) -> SpokenAnswerMode {
    SpokenAnswerMode(
      canListen: canListen, canSpeak: canSpeak, cantTalk: cantTalk, cantListen: cantListen,
      lockedAnswer: lockedAnswer, heard: heard)
  }
}
