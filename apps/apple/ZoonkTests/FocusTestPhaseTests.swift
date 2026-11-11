import XCTest

@testable import Zoonk

/// Main's `focus-test-phase.test.ts`: which screen the Focus test shows from its placement read.
final class FocusTestPhaseTests: XCTestCase {
  private let question = PracticeQuestion(itemId: "i1", format: .multipleChoice, question: "Q?")

  func testInvitesALearnerWhoHasntStartedWithTheSittingItWouldOpen() throws {
    let test = try focusTest(offer: offer)

    XCTAssertEqual(
      phase(.done, test, opening: true),
      .invitation(test, next: offered))
  }

  func testShowsTheResultOnceTheLearnerHasAnswersAndNoSittingIsOpen() throws {
    let test = try focusTest(offer: offer, checkpoint: checkpoint)

    XCTAssertEqual(phase(.done, test, opening: true), .checkpoint(test, end: nil))
  }

  func testAsksTheNextQuestionRightAfterAStartOrAnAnswer() throws {
    let test = try focusTest(sitting: sitting(answered: 3))

    guard case .question(let asked) = phase(.asking, test, next: question, opening: false) else {
      return XCTFail("Expected the question")
    }

    XCTAssertEqual(asked.question.itemId, "i1")
    XCTAssertEqual(asked.sitting.answered, 3)
  }

  func testNeverOpensOnAQuestionASittingWithAnswersWaitsOnItsResumeScreen() throws {
    let test = try focusTest(sitting: sitting(answered: 3))

    guard case .resume = phase(.asking, test, next: question, opening: true) else {
      return XCTFail("Expected the resume screen")
    }
  }

  func testInvitesAgainWhenASittingWasLeftBeforeItsFirstAnswer() throws {
    let test = try focusTest(sitting: sitting(answered: 0), offer: offer)

    XCTAssertEqual(
      phase(.asking, test, next: question, opening: true), .invitation(test, next: offered))
  }

  func testEndsASittingThatHasNothingMoreToAskWithItsReason() throws {
    let test = try focusTest(sitting: sitting(answered: 4, end: "settled"))

    XCTAssertEqual(phase(.done, test, opening: false), .ended(.settled))
  }

  func testWaitsWhileQuestionsAreWrittenAndSaysWhetherThereAreAnswersToUse() throws {
    let started = try focusTest(sitting: sitting(answered: 0), checkpoint: checkpoint)

    XCTAssertEqual(
      phase(.waitingForQuestions, started, opening: false),
      .waiting(answered: true, failure: nil))
    XCTAssertEqual(
      phase(.preparing, nil, opening: false), .waiting(answered: false, failure: nil))
  }

  func testStillInvitesWhileThePlanIsWrittenWhenTheSittingsSizeIsKnown() throws {
    let test = try focusTest(offer: offer)

    XCTAssertEqual(
      phase(.preparing, test, opening: true),
      .invitation(test, next: offered))
  }

  func testHasNothingToShowForAGoalWithNoTestOrATestWithNothingToAsk() throws {
    XCTAssertEqual(phase(.done, nil, opening: true), .unavailable)
    XCTAssertEqual(phase(.done, try focusTest(), opening: true), .unavailable)
    XCTAssertEqual(phase(.failed, try focusTest(offer: offer), opening: true), .unavailable)
  }

  private func phase(
    _ status: Components.Schemas.PlacementStatus, _ focusTest: FocusTest?,
    next: PracticeQuestion? = nil, opening: Bool
  ) -> FocusTestPhase {
    FocusTestPhase(
      status: status, focusTest: focusTest, next: next, labels: .trueFalse, opening: opening)
  }

  private let offer = #"{"kind":"first","questions":15,"minutes":15,"pastCeiling":9}"#
  private let offered = FocusTest.Offer(kind: .first, questions: 15, minutes: 15, pastCeiling: 9)
  private let checkpoint = #"{"focus":null,"lessonsSkipped":4}"#

  private func sitting(answered: Int, end: String? = nil) -> String {
    let endJSON = end.map { #""\#($0)""# } ?? "null"

    return #"""
      {"kind":"first","questions":15,"answered":\#(answered),"left":\#(15 - answered),
      "minutes":15,"subject":null,"hint":null,"end":\#(endJSON)}
      """#
  }

  private func focusTest(
    sitting: String = "null", offer: String = "null", checkpoint: String = "null"
  ) throws -> FocusTest {
    let json = #"""
      {"checkpoint":\#(checkpoint),"counts":{"asked":0,"quick":24,"total":24},"dated":true,
      "offer":\#(offer),"sessionQuestions":"off","sitting":\#(sitting),"subjects":[]}
      """#

    return try JSONDecoder().decode(FocusTest.self, from: Data(json.utf8))
  }
}
