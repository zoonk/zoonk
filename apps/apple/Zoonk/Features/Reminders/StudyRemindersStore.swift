import Foundation
import Observation

/// What asking for push led to.
enum PushSetup: Equatable, Sendable {
  case on
  /// The learner said no, now or before.
  case denied
  case failed
}

@MainActor
@Observable
final class StudyRemindersStore {
  let reminder: Resource<StudyReminder>

  /// Kept with the learner it's about, so the next learner never sees it.
  private var failedSave: AuthenticatedSession?

  var saveFailed: Bool {
    failedSave != nil && failedSave == cache.session.authenticatedSession
  }

  @ObservationIgnored private let api: any StudyRemindersAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let push: any PushAccess
  @ObservationIgnored private let defaults: UserDefaults
  @ObservationIgnored private let saves: QueuedSaves<StudyReminder>
  private static let tokenKey = "studyReminderPushToken"

  init(
    api: any StudyRemindersAPIClient, cache: AppCache, push: any PushAccess,
    defaults: UserDefaults = .standard
  ) {
    self.api = api
    self.cache = cache
    self.push = push
    self.defaults = defaults

    let reminder: Resource<StudyReminder> = cache.resource(
      audience: .signedIn, domains: [.studyReminder]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.getReminder(token: session.bearerToken)
    }
    self.reminder = reminder
    saves = QueuedSaves(reminder, cache: cache)
  }

  /// The token this installation last gave Zoonk, kept across launches and learners.
  private var savedToken: String? {
    get { defaults.string(forKey: Self.tokenKey) }
    set { defaults.set(newValue, forKey: Self.tokenKey) }
  }

  func isThisPhone(_ reminder: StudyReminder) -> Bool {
    reminder.phone != nil && reminder.phone?.token == savedToken
  }

  /// True only for the claim that marked the offer shown, here or on another device.
  func claimOffer() async -> Bool {
    let result = await cache.mutate(invalidating: [.studyReminder]) { [api] identity in
      try await api.claimOffer(token: identity.bearerToken)
    }

    if case .done(true) = result {
      return true
    }

    return false
  }

  /// Permission, then this phone, then push on (at `time` when given). Done only once both saved.
  func turnOnPush(at time: String? = nil) async -> PushSetup {
    await selectThisPhone { [api] identity, _ in
      try await api.updateReminder(
        token: identity.bearerToken, StudyReminderChange(time: time, pushOn: true))
    }
  }

  /// Push goes to this phone from now on, on or off as it was.
  func useThisPhone() async -> PushSetup {
    await selectThisPhone { _, saved in saved }
  }

  func turnOnEmail(at time: String) async -> Bool {
    let result = await cache.mutate(invalidating: [.studyReminder]) { [api] identity in
      try await api.updateReminder(
        token: identity.bearerToken, StudyReminderChange(time: time, emailOn: true))
    }

    return show(result)
  }

  /// Settings' changes, saved in the order made.
  func change(_ change: StudyReminderChange) async {
    failedSave = nil

    let result = await saves.save(change.applied, invalidating: [.studyReminder]) { [api] in
      try await api.updateReminder(token: $0.bearerToken, change)
    } confirm: { _, saved in
      saved
    }

    if case .failed = result {
      failedSave = cache.session.authenticatedSession
    }
  }

  /// At launch: push keeps reaching this phone when the system gave it a new token.
  func refreshPhoneToken() async {
    guard let saved = savedToken, await push.isAuthorized(), let current = await push.deviceToken(),
      current != saved
    else {
      return
    }

    let result = await cache.mutate(invalidating: [.studyReminder]) { [api] identity in
      if try await api.getReminder(token: identity.bearerToken).phone?.token == saved {
        _ = try await api.selectPhone(token: identity.bearerToken, pushToken: current)
      }
    }

    if case .done = result {
      savedToken = current
    }
  }

  /// Before signing out, so push stops reaching this phone for the learner who left it. The server
  /// removes the phone only while it's still this one.
  func forgetThisPhone(_ identity: AuthenticatedSession) async {
    guard let savedToken else {
      return
    }

    try? await api.removePhone(token: identity.bearerToken, pushToken: savedToken)
  }

  private func selectThisPhone(
    then save:
      @escaping @Sendable (AuthenticatedSession, StudyReminder) async throws ->
      StudyReminder
  ) async -> PushSetup {
    guard await push.requestAuthorization() else {
      return .denied
    }

    guard let token = await push.deviceToken() else {
      return .failed
    }

    savedToken = token

    let result = await cache.mutate(invalidating: [.studyReminder]) { [api] identity in
      let selected = try await api.selectPhone(token: identity.bearerToken, pushToken: token)
      return try await save(identity, selected)
    }

    return show(result) ? .on : .failed
  }

  /// A failure may come after the phone saved, so what's shown is read again.
  private func show(_ result: MutationResult<StudyReminder>) -> Bool {
    switch result {
    case .done(let saved):
      reminder.update { _ in saved }
      return true
    case .failed:
      reminder.invalidate()
      return false
    case .obsolete:
      return false
    }
  }
}
