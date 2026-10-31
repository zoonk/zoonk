import XCTest

@testable import Zoonk

@MainActor
final class FeedbackFormStoreTests: XCTestCase {
  func testSubmitNormalizesFieldsAndPublishesSuccess() async {
    let api = FeedbackAPISpy(result: .success(()))
    let context = FeedbackContext(contentID: CourseChapter.testFixture.id, contentKind: .chapter)
    let store = FeedbackFormStore(
      api: api,
      context: context,
      defaultEmail: "  LEARNER@zoonk.test ",
      token: "learner-session")
    store.message = "  Please clarify the first chapter. \n"

    await store.submit()

    let submissions = await api.submissions()

    XCTAssertEqual(store.state, .sent)
    XCTAssertEqual(
      submissions,
      [
        FeedbackSubmissionRecord(
          submission: FeedbackSubmission(
            context: context,
            email: "learner@zoonk.test",
            message: "Please clarify the first chapter."),
          token: "learner-session")
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

private struct FeedbackSubmissionRecord: Equatable {
  let submission: FeedbackSubmission
  let token: String?
}

private actor FeedbackAPISpy: FeedbackAPIClient {
  private var recordedSubmissions = [FeedbackSubmissionRecord]()
  private let result: Result<Void, Error>

  init(result: Result<Void, Error>) {
    self.result = result
  }

  func submit(_ submission: FeedbackSubmission, token: String?) async throws {
    recordedSubmissions.append(FeedbackSubmissionRecord(submission: submission, token: token))
    try result.get()
  }

  func submissions() -> [FeedbackSubmissionRecord] {
    recordedSubmissions
  }
}
