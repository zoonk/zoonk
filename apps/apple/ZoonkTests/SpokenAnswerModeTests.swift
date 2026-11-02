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

  func testABlockedMicrophoneTypesTheSentence() {
    XCTAssertEqual(mode(micBlocked: true), .type)
    XCTAssertEqual(mode(canListen: true, micBlocked: true), .type)
  }

  func testNoRecorderStillLeavesAWayToAnswer() {
    XCTAssertEqual(mode(canListen: true, canSpeak: false), .listen)
    XCTAssertEqual(mode(canSpeak: false), .type)
  }

  private func mode(
    canListen: Bool = false, canSpeak: Bool = true, cantTalk: Bool = false, micBlocked: Bool = false
  ) -> SpokenAnswerMode {
    SpokenAnswerMode(
      canListen: canListen, canSpeak: canSpeak, cantTalk: cantTalk, micBlocked: micBlocked)
  }
}
