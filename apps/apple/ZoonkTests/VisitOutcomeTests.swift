import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class VisitOutcomeTests: XCTestCase {
  /// A later change on the same page doesn't hide an earlier one that failed: the time's save fails
  /// while the email's, made after it, saves, and the page still says so (review of `697b994fb2`).
  func testATimeThatDidntSaveSaysSoWhenTheEmailSavedMeanwhile() async throws {
    let api = VisitRemindersAPI(fails: { $0.time != nil })
    await api.holdUpdates()
    let window = try await host(RemindersView {}, reminders: api)

    try await waitForTestCondition("The reminder time picker did not appear") {
      !views(UIDatePicker.self, in: window).isEmpty
    }
    let picker = try XCTUnwrap(views(UIDatePicker.self, in: window).first, "The time's picker")
    picker.date = picker.date.addingTimeInterval(3_600)
    picker.sendActions(for: .valueChanged)
    await api.waitForHeldUpdate()
    try await activate(where: { $0.hasPrefix(Self.email) }, in: window)
    await api.releaseUpdate()
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntSave, in: window)
    }
    XCTAssertTrue(
      shows(Self.didntSave, in: window), "The time's failure shows: \(spoken(in: window))")
  }

  private static let didntSave = String(
    localized: "That didn't save. Try again.", table: "Settings")
  private static let email = String(localized: "Email reminders", table: "Reminders")

  /// Shows the page once what it reads has loaded.
  private func host(_ page: some View, reminders: VisitRemindersAPI) async throws -> UIWindow {
    let dependencies = AppDependencies.hosted()
    try await readsWhatVoiceOverReads()
    let window = try show(
      NavigationStack { page }
        .environment(
          StudyRemindersStore(
            api: reminders, cache: dependencies.cache, push: PushNotifications.shared)
        )
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)
    return window
  }

  private func views<Kind: UIView>(_ kind: Kind.Type, in view: UIView) -> [Kind] {
    ((view as? Kind).map { [$0] } ?? []) + view.subviews.flatMap { views(kind, in: $0) }
  }

  private func shows(_ line: String, in window: UIWindow) -> Bool {
    spoken(in: window).contains { $0.contains(line) }
  }
}

/// A reminder with email off, whose changes fail (those `fails` names) after they're released when
/// held.
private actor VisitRemindersAPI: StudyRemindersAPIClient {
  private static let reminder = StudyReminder(
    time: "20:00", timeZone: "America/Sao_Paulo", emailOn: false,
    emailAddress: "learner@zoonk.test", pushOn: false, phone: nil, quiet: false)

  private let fails: @Sendable (StudyReminderChange) -> Bool
  private var holds = false
  private var held: TestContinuation<Void>?
  private var completed = 0
  private var heldWaiter: TestContinuation<Void>?

  init(fails: @escaping @Sendable (StudyReminderChange) -> Bool = { _ in true }) {
    self.fails = fails
  }

  func holdUpdates() { holds = true }

  func waitForHeldUpdate(file: StaticString = #filePath, line: UInt = #line) async {
    guard held == nil else {
      return
    }

    await withTestVoidContinuation(file: file, line: line) { heldWaiter = $0 }
  }

  func releaseUpdate(file: StaticString = #filePath, line: UInt = #line) async {
    let before = completed
    held?.resume()
    held = nil
    _ = try? await waitForTestCondition(
      "The released response did not finish", file: file, line: line
    ) { await self.completed > before }
  }

  func getReminder(token: String) async throws -> StudyReminder {
    Self.reminder
  }

  func updateReminder(token: String, _ change: StudyReminderChange) async throws -> StudyReminder {
    defer { completed += 1 }
    if holds {
      holds = false
      await withTestVoidContinuation { continuation in
        held = continuation
        heldWaiter?.resume()
        heldWaiter = nil
      }
    }

    guard !fails(change) else {
      throw APIError.unavailable
    }

    return change.applied(to: Self.reminder)
  }

  func claimOffer(token: String) async throws -> Bool { false }

  func selectPhone(token: String, pushToken: String) async throws -> StudyReminder {
    throw APIError.unavailable
  }
}
