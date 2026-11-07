import XCTest

@testable import Zoonk

@MainActor
final class StudyRemindersTests: XCTestCase {
  func testRemindMeSelectsThisPhoneBeforeTurningPushOn() async {
    let api = StudyRemindersAPIStub()
    let store = makeStore(api: api, push: PushStub(allows: true, token: "token-1"))

    let result = await store.turnOnPush(at: "20:30")

    XCTAssertEqual(result, .on)
    let calls = await api.calls
    XCTAssertEqual(calls, ["select token-1", "update time 20:30 push true"])
  }

  func testRemindMeWithoutPermissionSavesNothing() async {
    let api = StudyRemindersAPIStub()
    let store = makeStore(api: api, push: PushStub(allows: false, token: "token-1"))

    let result = await store.turnOnPush(at: "20:30")

    XCTAssertEqual(result, .denied)
    let calls = await api.calls
    XCTAssertEqual(calls, [])
  }

  func testRemindMeIsntOnWhenPushFailsAfterThePhoneSaved() async {
    let api = StudyRemindersAPIStub(updateError: .unavailable)
    let store = makeStore(api: api, push: PushStub(allows: true, token: "token-1"))

    let result = await store.turnOnPush(at: "20:30")

    XCTAssertEqual(result, .failed)
    let calls = await api.calls
    XCTAssertEqual(calls, ["select token-1", "update time 20:30 push true"])
  }

  func testANewTokenAtLaunchMovesPushOnlyWhenThisWasThePhone() async {
    let defaults = UserDefaults(suiteName: UUID().uuidString)!
    let push = PushStub(allows: true, token: "token-1")
    _ = await makeStore(api: StudyRemindersAPIStub(), push: push, defaults: defaults)
      .turnOnPush()
    push.token = "token-2"

    let selected = StudyRemindersAPIStub(phoneToken: "token-1")
    await makeStore(api: selected, push: push, defaults: defaults).refreshPhoneToken()
    let other = StudyRemindersAPIStub(phoneToken: "another-phone")
    await makeStore(api: other, push: push, defaults: .init(suiteName: UUID().uuidString)!)
      .refreshPhoneToken()

    let selectedCalls = await selected.calls
    XCTAssertEqual(selectedCalls, ["get", "select token-2"])
    let otherCalls = await other.calls
    XCTAssertEqual(otherCalls, [], "an installation that never chose push asks for nothing")
  }

  func testATappedReminderMakesItsGoalActiveThenOpensToday() async throws {
    let tap = try XCTUnwrap(
      StudyReminderTap(["type": "study_reminder", "goalId": "goal-2", "aps": [:]]))
    XCTAssertNil(StudyReminderTap(["type": "other", "goalId": "goal-2"]))
    XCTAssertNil(StudyReminderTap(["type": "study_reminder"]))

    let router = AppRouter()
    router.select(.plan)
    router.open(.session)
    var switched: [String] = []

    await router.openStudyReminder(goalID: tap.goalID) { goalID in
      switched.append(goalID)
      return .failed(.network)
    }

    XCTAssertEqual(switched, ["goal-2"])
    XCTAssertEqual(router.selectedTab, .today, "a failed switch still opens Today")
    XCTAssertEqual(router.tasks, [])
  }

  private func makeStore(
    api: StudyRemindersAPIStub, push: PushStub,
    defaults: UserDefaults = UserDefaults(suiteName: UUID().uuidString)!
  ) -> StudyRemindersStore {
    StudyRemindersStore(api: api, cache: signedInCache(), push: push, defaults: defaults)
  }
}

@MainActor
private func signedInCache() -> AppCache {
  AppCache(
    session: .preview(
      account: CurrentAccount(
        account: AccountAccess(
          deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
        user: AccountUser(
          email: "learner@zoonk.test", id: "reminders-test-user", image: nil, name: "Learner",
          username: "learner"))))
}

@MainActor
private final class PushStub: PushAccess {
  let allows: Bool
  var token: String?

  init(allows: Bool, token: String?) {
    self.allows = allows
    self.token = token
  }

  func requestAuthorization() async -> Bool { allows }
  func deviceToken() async -> String? { token }
  func isAuthorized() async -> Bool { allows }
}

private actor StudyRemindersAPIStub: StudyRemindersAPIClient {
  private(set) var calls: [String] = []
  private let updateError: APIError?
  private let phoneToken: String?

  init(updateError: APIError? = nil, phoneToken: String? = nil) {
    self.updateError = updateError
    self.phoneToken = phoneToken
  }

  func getReminder(token: String) async throws -> StudyReminder {
    calls.append("get")
    return reminder(phoneToken: phoneToken)
  }

  func updateReminder(token: String, _ change: StudyReminderChange) async throws -> StudyReminder {
    calls.append(
      "update time \(change.time ?? "-") push \(change.pushOn.map(String.init) ?? "-")")

    if let updateError {
      throw updateError
    }

    return change.applied(to: reminder(phoneToken: phoneToken))
  }

  func claimOffer(token: String) async throws -> Bool { true }

  func selectPhone(token: String, pushToken: String) async throws -> StudyReminder {
    calls.append("select \(pushToken)")
    return reminder(phoneToken: pushToken)
  }

  func removePhone(token: String, pushToken: String) async throws {
    calls.append("remove \(pushToken)")
  }

  private func reminder(phoneToken: String?) -> StudyReminder {
    StudyReminder(
      time: "19:00", timeZone: "America/Sao_Paulo", emailOn: false,
      emailAddress: "learner@zoonk.test", pushOn: false,
      phone: phoneToken.map { StudyReminder.Phone(label: "iPhone", token: $0) }, quiet: false)
  }
}
