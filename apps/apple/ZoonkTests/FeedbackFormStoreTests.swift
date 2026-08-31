import XCTest

@testable import Zoonk

@MainActor
final class FeedbackFormStoreTests: XCTestCase {
  func testSubmitNormalizesFieldsAndPublishesSuccess() async {
    let api = FeedbackAPISpy(result: .success(()))
    let store = FeedbackFormStore(
      api: api,
      defaultEmail: "  LEARNER@zoonk.test ")
    store.message = "  Please clarify the first chapter. \n"

    await store.submit()

    let submissions = await api.submissions()

    XCTAssertEqual(store.state, .sent)
    XCTAssertEqual(
      submissions,
      [
        FeedbackSubmission(
          email: "learner@zoonk.test",
          message: "Please clarify the first chapter.")
      ])
  }

  func testFailurePublishesRecoverableState() async {
    let api = FeedbackAPISpy(result: .failure(FeedbackFailure.network))
    let store = FeedbackFormStore(api: api, defaultEmail: "learner@zoonk.test")
    store.message = "Please clarify the first chapter."

    await store.submit()

    XCTAssertEqual(store.state, .failed(.network))
  }

  func testBlankFieldsDoNotSubmit() async {
    let api = FeedbackAPISpy(result: .success(()))
    let store = FeedbackFormStore(api: api, defaultEmail: "learner@zoonk.test")
    store.message = "   \n"

    await store.submit()

    let submissions = await api.submissions()

    XCTAssertEqual(store.state, .idle)
    XCTAssertTrue(submissions.isEmpty)
  }

  func testCancellationReturnsToIdle() async {
    let api = FeedbackAPISpy(result: .failure(CancellationError()))
    let store = FeedbackFormStore(api: api, defaultEmail: "learner@zoonk.test")
    store.message = "Please clarify the first chapter."

    await store.submit()

    XCTAssertEqual(store.state, .idle)
  }
}

private actor FeedbackAPISpy: FeedbackAPIClient {
  private var recordedSubmissions = [FeedbackSubmission]()
  private let result: Result<Void, Error>

  init(result: Result<Void, Error>) {
    self.result = result
  }

  func submit(_ submission: FeedbackSubmission) async throws {
    recordedSubmissions.append(submission)
    try result.get()
  }

  func submissions() -> [FeedbackSubmission] {
    recordedSubmissions
  }
}
