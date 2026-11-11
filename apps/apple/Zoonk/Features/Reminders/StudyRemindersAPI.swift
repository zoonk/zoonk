import Foundation
import UIKit

protocol StudyRemindersAPIClient: Sendable {
  func getReminder(token: String) async throws -> StudyReminder
  func updateReminder(token: String, _ change: StudyReminderChange) async throws -> StudyReminder
  /// True only for the call that marked the offer shown.
  func claimOffer(token: String) async throws -> Bool
  /// Makes this phone the one push goes to, for as long as this session lasts; push stays as it was.
  func selectPhone(token: String, pushToken: String) async throws -> StudyReminder
}

struct StudyRemindersAPI: StudyRemindersAPIClient {
  let clients: APIClientFactory

  /// Reminders are written in the app's language.
  private var locale: String { currentCourseCatalogLanguage() }

  func getReminder(token: String) async throws -> StudyReminder {
    try await clients.perform(token: token) { client in
      switch try await client.getCurrentUserStudyReminder() {
      case .ok(let response):
        return StudyReminder(try response.body.json.reminder)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func updateReminder(token: String, _ change: StudyReminderChange) async throws -> StudyReminder {
    let body = Components.Schemas.StudyReminderUpdate(
      emailOn: change.emailOn, locale: .init(rawValue: locale) ?? .en, pushOn: change.pushOn,
      time: change.time)

    return try await clients.perform(token: token) { client in
      switch try await client.updateCurrentUserStudyReminder(body: .json(body)) {
      case .ok(let response):
        return StudyReminder(try response.body.json.reminder)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func claimOffer(token: String) async throws -> Bool {
    let body = Components.Schemas.StudyReminderOfferClaim(locale: .init(rawValue: locale) ?? .en)

    return try await clients.perform(token: token) { client in
      switch try await client.claimCurrentUserStudyReminderOffer(body: .json(body)) {
      case .ok(let response):
        return try response.body.json.claimed
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

  func selectPhone(token: String, pushToken: String) async throws -> StudyReminder {
    let body = Components.Schemas.StudyReminderPhone(
      label: await UIDevice.current.name, locale: .init(rawValue: locale) ?? .en, platform: .ios,
      token: pushToken)

    return try await clients.perform(token: token) { client in
      switch try await client.selectCurrentUserStudyReminderPhone(body: .json(body)) {
      case .ok(let response):
        return StudyReminder(try response.body.json.reminder)
      case .unauthorized:
        throw APIError.unauthorized
      default:
        throw APIError.unavailable
      }
    }
  }

}
