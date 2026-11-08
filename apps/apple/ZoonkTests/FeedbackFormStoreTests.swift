import XCTest

@testable import Zoonk

@MainActor
final class FeedbackFormStoreTests: XCTestCase {
  func testUnloadedSummaryDoesNotUseTheSessionEmail() async {
    let api = FeedbackAPISpy(result: .success(()))
    let session = SessionStore.preview(
      account: CurrentAccount(
        account: AccountAccess(
          deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
        user: AccountUser(
          email: "guest@zoonk.test", id: "guest", image: nil, name: "Guest", username: nil)))
    let learner = LearnerSummaryStore(
      api: LearnerSummaryAPI(clients: .live(baseURL: AppConfiguration.current.apiBaseURL)),
      cache: AppCache(session: session))
    let store = FeedbackFormStore(
      api: api, context: FeedbackContext(screen: "placement-question", reportType: .saveFailure),
      session: session, learner: learner)

    XCTAssertNil(learner.summary.value)
    XCTAssertTrue(store.defaultEmail.isEmpty)
    XCTAssertTrue(store.email.isEmpty)
    XCTAssertTrue(store.asksForEmail)
    store.email = "reply@zoonk.test"

    await store.submit()

    let submissions = await api.submissions()
    XCTAssertEqual(store.state, .sent)
    XCTAssertEqual(submissions.first?.submission.email, "reply@zoonk.test")
  }

  func testSaveReportSubmitsWithoutAnEmailAndKeepsItsContext() async {
    let api = FeedbackAPISpy(result: .success(()))
    let context = FeedbackContext(screen: "placement-question", reportType: .saveFailure)
    let store = FeedbackFormStore(api: api, context: context, token: "guest-session")

    XCTAssertEqual(store.message, "I couldn't save my answers.")
    XCTAssertTrue(store.canSubmit)
    store.email = "  \n"
    store.message = "My answers still won't save."

    await store.submit()

    let submissions = await api.submissions()
    XCTAssertEqual(store.state, .sent)
    XCTAssertEqual(
      submissions,
      [
        FeedbackSubmissionRecord(
          submission: FeedbackSubmission(
            context: context, email: nil, message: "My answers still won't save."),
          token: "guest-session")
      ])
  }

  func testSaveReportValidatesATypedEmailAndRequiresAMessage() async {
    let api = FeedbackAPISpy(result: .success(()))
    let store = FeedbackFormStore(
      api: api, context: FeedbackContext(screen: "level-test", reportType: .saveFailure))
    store.email = "invalid-email"

    await store.submit()

    XCTAssertFalse(store.canSubmit)
    let submissions = await api.submissions()
    XCTAssertTrue(submissions.isEmpty)
    store.email = "learner@zoonk.test"
    XCTAssertTrue(store.canSubmit)
    store.message = "  \n"
    XCTAssertFalse(store.canSubmit)
  }

  func testRegularFeedbackAndContentReportsStillRequireAnEmail() {
    let api = FeedbackAPISpy(result: .success(()))
    for context in [
      nil, FeedbackContext(contentID: "chapter-id", contentKind: .chapter),
      FeedbackContext(screen: "exam"),
    ] {
      let store = FeedbackFormStore(api: api, context: context)
      XCTAssertTrue(store.message.isEmpty)
      store.message = "Please help."
      XCTAssertFalse(store.canSubmit)
      store.email = "learner@zoonk.test"
      XCTAssertTrue(store.canSubmit)
    }
  }

  func testFailedSaveReportKeepsTheDraftAndCanRetry() async {
    let api = FeedbackAPISpy(result: .failure(FeedbackFailure.unavailable))
    let store = FeedbackFormStore(
      api: api, context: FeedbackContext(screen: "placement-question", reportType: .saveFailure))
    store.message = "These answers won't save."

    await store.submit()
    await store.submit()

    XCTAssertEqual(store.state, .failed(.unavailable))
    XCTAssertEqual(store.message, "These answers won't save.")
    XCTAssertTrue(store.email.isEmpty)
    let submissions = await api.submissions()
    XCTAssertEqual(submissions.count, 2)
  }

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
