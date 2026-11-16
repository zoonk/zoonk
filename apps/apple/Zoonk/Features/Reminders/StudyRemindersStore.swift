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

  @ObservationIgnored private let api: any StudyRemindersAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let push: any PushAccess
  @ObservationIgnored private let defaults: UserDefaults
  @ObservationIgnored private let saves: QueuedSaves<StudyReminder>
  /// Push turned on or off again while a setup waits wins, as on Android.
  @ObservationIgnored private var pushChoices = 0
  private static let tokenKey = "studyReminderPushToken"

  init(
    api: any StudyRemindersAPIClient, cache: AppCache, push: any PushAccess,
    defaults: UserDefaults = .standard
  ) {
    self.api = api
    self.cache = cache
    self.push = push
    self.defaults = defaults

    // The zone and default time follow the active goal, and studying ends the quiet state.
    let reminder: Resource<StudyReminder> = cache.resource(
      audience: .signedIn, domains: [.studyReminder, .goals, .learningProfile, .userProgress]
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
  /// Like every change here, it goes on when the screen that asked goes away first.
  func turnOnPush(at time: String? = nil) async -> PushSetup {
    pushChoices += 1
    let enable = StudyReminderChange(time: time, pushOn: true)
    return await Task { await self.selectThisPhone(then: enable) }.value
  }

  /// Push goes to this phone from now on, on or off as it was.
  func useThisPhone() async -> PushSetup {
    await Task { await self.selectThisPhone(then: nil) }.value
  }

  func turnOnEmail(at time: String) async -> Bool {
    await Task {
      let result = await self.cache.mutate(invalidating: [.studyReminder]) { [api] identity in
        try await api.updateReminder(
          token: identity.bearerToken, StudyReminderChange(time: time, emailOn: true))
      }

      return self.show(result)
    }.value
  }

  /// Settings' changes, saved in the order made. False when it didn't save.
  @discardableResult
  func change(_ change: StudyReminderChange) async -> Bool {
    if change.pushOn != nil {
      pushChoices += 1
    }

    let result = await saves.save(change.applied, invalidating: [.studyReminder]) { [api] in
      try await api.updateReminder(token: $0.bearerToken, change)
    } confirm: { _, saved in
      saved
    }

    if case .failed = result {
      return false
    }

    return true
  }

  /// At launch: push keeps reaching this phone when the system gave it a new token. The saved token
  /// moves on only once the learner whose phone it is gets the new one; another learner signed in
  /// here leaves it for them.
  func refreshPhoneToken() async {
    let owner = cache.session.authenticatedSession

    guard let saved = savedToken, await push.isAuthorized(), let current = await push.deviceToken(),
      current != saved, cache.session.authenticatedSession == owner
    else {
      return
    }

    let result = await cache.mutate(invalidating: [.studyReminder]) { [api] identity in
      guard try await api.getReminder(token: identity.bearerToken).phone?.token == saved else {
        return false
      }

      _ = try await api.selectPhone(token: identity.bearerToken, pushToken: current)
      return true
    }

    if case .done(true) = result {
      savedToken = current
    }
  }

  /// Turning push on for no phone yet, or for this one, asks for permission first; for another
  /// device it's that device's consent alone. Nil when no setup ran and the plain change saved.
  func setPush(_ on: Bool, in reminder: StudyReminder) async -> PushSetup? {
    guard on, reminder.phone == nil || isThisPhone(reminder) else {
      return await change(StudyReminderChange(pushOn: on)) ? nil : .failed
    }

    return await turnOnPush()
  }

  /// The permission prompt, the system's registration and the phone's selection take a while: a
  /// learner who signs out meanwhile never gets push turned on, for them or whoever signs in next.
  /// Each write runs only while its learner is still signed in, and the token is kept once the
  /// phone is theirs.
  private func selectThisPhone(then enable: StudyReminderChange?) async -> PushSetup {
    let owner = cache.session.authenticatedSession
    let choice = pushChoices

    guard await push.requestAuthorization() else {
      return .denied
    }

    guard let token = await push.deviceToken(), cache.session.authenticatedSession == owner else {
      return .failed
    }

    let selected = await cache.mutate(invalidating: [.studyReminder]) { [api] identity in
      try await api.selectPhone(token: identity.bearerToken, pushToken: token)
    }

    guard case .done = selected else {
      return show(selected) ? .on : .failed
    }

    savedToken = token

    guard let enable, choice == pushChoices else {
      return show(selected) ? .on : .failed
    }

    let enabled = await cache.mutate(invalidating: [.studyReminder]) { [api] identity in
      try await api.updateReminder(token: identity.bearerToken, enable)
    }

    return show(enabled) ? .on : .failed
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
