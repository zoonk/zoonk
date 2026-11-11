import Observation
import UIKit
import UserNotifications

/// What reminders need from the system's notifications, so tests can answer for it.
@MainActor
protocol PushAccess: AnyObject {
  /// Asks once; later calls answer with what the learner chose.
  func requestAuthorization() async -> Bool
  /// Nil when the system couldn't register this installation.
  func deviceToken() async -> String?
  func isAuthorized() async -> Bool
}

/// The app's one link to the system's notifications: its delegate callbacks land here.
@MainActor
@Observable
final class PushNotifications: PushAccess {
  static let shared = PushNotifications()

  /// The goal a tapped study reminder opens Today on, until a window takes it.
  private(set) var openedGoalID: String?

  @ObservationIgnored private var waiting: [CheckedContinuation<String?, Never>] = []

  func requestAuthorization() async -> Bool {
    (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]))
      ?? false
  }

  func isAuthorized() async -> Bool {
    await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
      == .authorized
  }

  func isDenied() async -> Bool {
    await UNUserNotificationCenter.current().notificationSettings().authorizationStatus == .denied
  }

  func deviceToken() async -> String? {
    await withCheckedContinuation { continuation in
      waiting.append(continuation)

      if waiting.count == 1 {
        UIApplication.shared.registerForRemoteNotifications()
      }
    }
  }

  func registered(_ token: Data) {
    finishRegistering(token.map { String(format: "%02x", $0) }.joined())
  }

  func failedToRegister() {
    finishRegistering(nil)
  }

  func open(_ tap: StudyReminderTap) {
    openedGoalID = tap.goalID
  }

  func takeOpenedGoal() -> String? {
    defer { openedGoalID = nil }
    return openedGoalID
  }

  /// A reminder already read about in the app shouldn't wait in Notification Center.
  func clearDeliveredReminders() async {
    let center = UNUserNotificationCenter.current()
    let reminders = await center.deliveredNotifications()
      .filter { StudyReminderTap($0.request.content.userInfo) != nil }
      .map(\.request.identifier)

    center.removeDeliveredNotifications(withIdentifiers: reminders)
  }

  private func finishRegistering(_ token: String?) {
    let waiting = waiting
    self.waiting = []

    for continuation in waiting {
      continuation.resume(returning: token)
    }
  }
}

/// A study reminder's payload: `type` "study_reminder" and the `goalId` it's about.
struct StudyReminderTap: Equatable {
  let goalID: String

  init?(_ userInfo: [AnyHashable: Any]) {
    guard userInfo["type"] as? String == "study_reminder",
      let goalID = userInfo["goalId"] as? String, !goalID.isEmpty
    else {
      return nil
    }

    self.goalID = goalID
  }

  /// The server sends reminders in this category, so with previews hidden the Lock Screen still
  /// says what arrived.
  static var category: UNNotificationCategory {
    UNNotificationCategory(
      identifier: "study_reminder", actions: [], intentIdentifiers: [],
      hiddenPreviewsBodyPlaceholder: String(
        localized: "Study reminder", table: "Reminders",
        comment:
          "Shown on the Lock Screen for a study reminder when notification previews are hidden"
      ))
  }
}

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  /// Set before launch ends, so a tap that launched the app still reaches it.
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    UNUserNotificationCenter.current().setNotificationCategories([StudyReminderTap.category])
    return true
  }

  func application(
    _ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data
  ) {
    PushNotifications.shared.registered(token)
  }

  func application(
    _ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    PushNotifications.shared.failedToRegister()
  }

  /// The learner is already in the app, so a reminder stays quiet.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter, willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    StudyReminderTap(notification.request.content.userInfo) == nil ? [.banner, .list, .sound] : []
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse
  ) async {
    if let tap = StudyReminderTap(response.notification.request.content.userInfo) {
      PushNotifications.shared.open(tap)
    }
  }
}
