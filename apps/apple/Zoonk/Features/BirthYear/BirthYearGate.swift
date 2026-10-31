import Foundation
import Observation

/// Every account answers its birth year once before it keeps learning, and a visitor answers it
/// before the write that starts their guest, which starts only once the server finds them old
/// enough. A refusal stays on the device for a day, so another year can't be tried right away.
@MainActor
@Observable
final class BirthYearGate {
  enum Prompt: Equatable {
    /// A visitor can still back out while no guest exists.
    case question(canCancel: Bool)
    /// An account can't go on, so closing it logs out; a visitor just closes it.
    case belowMinimumAge(Int, logsOut: Bool)
  }

  enum Failure: Equatable {
    case invalidYear
    case unsaved
  }

  private(set) var isSaving = false
  /// Kept with the learner it's about, so the next one never sees it.
  private var notice: (owner: AuthenticatedSession?, failure: Failure)?
  /// Shown only to the session it was made in, and cleared when the session changes.
  private var refusal: (owner: AuthenticatedSession?, minimumAge: Int)?
  /// The visitors' writes waiting for a guest, each resumed once.
  private var waitingWrites: [UUID: CheckedContinuation<Bool, Never>] = [:]
  /// The visitor's guest until its year is saved; only then is it signed in, so nothing learns
  /// before that.
  private var pendingGuest: AuthenticatedSession?

  @ObservationIgnored private let api: any BirthYearAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let summary: Resource<LearnerSummary>
  @ObservationIgnored private let defaults: UserDefaults
  @ObservationIgnored private let now: () -> Date

  init(
    api: any BirthYearAPIClient,
    cache: AppCache,
    summary: Resource<LearnerSummary>,
    defaultsSuite: String? = nil,
    now: @escaping () -> Date = Date.init
  ) {
    self.api = api
    self.cache = cache
    self.summary = summary
    self.defaults = defaultsSuite.flatMap(UserDefaults.init(suiteName:)) ?? .standard
    self.now = now
  }

  var failure: Failure? {
    notice?.owner == session.authenticatedSession ? notice?.failure : nil
  }

  var prompt: Prompt? {
    if let refusal, refusal.owner == session.authenticatedSession {
      return .belowMinimumAge(refusal.minimumAge, logsOut: refusal.owner != nil)
    }

    if isVisitorWaiting {
      return .question(canCancel: pendingGuest == nil)
    }

    guard summary.value?.needsBirthYear == true else {
      return nil
    }

    return rememberedRefusal.map { .belowMinimumAge($0, logsOut: true) }
      ?? .question(canCancel: false)
  }

  /// A visitor's write waits here for its guest: true once one is signed in with a saved birth
  /// year, false when the visitor backs out, is too young, signs in some other way meanwhile, or
  /// the write's task is cancelled.
  func startGuest() async -> Bool {
    if session.authenticatedSession != nil {
      return true
    }

    if let rememberedRefusal {
      refusal = (nil, rememberedRefusal)
      return false
    }

    let id = UUID()

    return await withTaskCancellationHandler {
      await withCheckedContinuation { write in
        if Task.isCancelled {
          write.resume(returning: false)
        } else {
          waitingWrites[id] = write
        }
      }
    } onCancel: {
      Task { @MainActor in
        self.stopWaiting(id)
      }
    }
  }

  func submit(_ year: Int) async {
    guard !isSaving else {
      return
    }

    notice = nil
    isSaving = true
    defer { isSaving = false }

    if session.authenticatedSession == nil {
      await submitForVisitor(year)
    } else {
      await submitForAccount(year)
    }
  }

  /// Only a visitor's, and not while a year is on its way: nothing starts, and a refusal stays
  /// remembered on the device.
  func close() {
    guard session.authenticatedSession == nil, !isSaving, pendingGuest == nil else {
      return
    }

    refusal = nil
    finish(startingWrites: false)
  }

  /// A session that started some other way, such as a sign-in, ends what a visitor was waiting
  /// for, and a message the last one got.
  func followSession() {
    if refusal?.owner != session.authenticatedSession {
      refusal = nil
    }

    guard session.authenticatedSession != nil, !isSaving, !waitingWrites.isEmpty else {
      return
    }

    finish(startingWrites: false)
  }

  /// An account below the minimum age leaves, on this device even when the server can't be told.
  func logOut() async {
    guard let identity = session.authenticatedSession, !isSaving else {
      return
    }

    refusal = nil
    isSaving = true
    defer { isSaving = false }

    await session.signOut()
    await session.expire(identity)
  }

  private var session: SessionStore {
    cache.session
  }

  private var isVisitorWaiting: Bool {
    session.authenticatedSession == nil && !waitingWrites.isEmpty
  }

  private var rememberedRefusal: Int? {
    guard let saved = defaults.dictionary(forKey: Self.refusalKey),
      let refusedAt = saved[Self.dateKey] as? Date,
      now().timeIntervalSince(refusedAt) < Self.refusalDuration
    else {
      return nil
    }

    return saved[Self.minimumAgeKey] as? Int
  }

  /// After each request the visitor must still be waiting with no session of their own, or the
  /// submission is dropped.
  private func submitForVisitor(_ year: Int) async {
    guard isVisitorWaiting else {
      return
    }

    if pendingGuest == nil {
      guard let guest = await createGuest(bornIn: year) else {
        return
      }

      pendingGuest = guest
    }

    guard let guest = pendingGuest else {
      return
    }

    let answer: BirthYearAnswer

    do {
      answer = try await api.save(year, token: guest.bearerToken)
    } catch {
      failVisitor()

      return
    }

    guard isVisitorWaiting else {
      finish(startingWrites: false)
      return
    }

    switch answer {
    case .accepted:
      guard await session.adoptGuest(guest) else {
        failVisitor()

        return
      }

      finish(startingWrites: true)
    case .invalidYear:
      fail(.invalidYear)
    case .belowMinimumAge(let minimumAge):
      refuse(minimumAge)
    }
  }

  private func createGuest(bornIn year: Int) async -> AuthenticatedSession? {
    let answer: BirthYearAnswer

    do {
      answer = try await api.check(year)
    } catch {
      failVisitor()

      return nil
    }

    guard isVisitorWaiting else {
      finish(startingWrites: false)
      return nil
    }

    switch answer {
    case .accepted:
      let guest = await session.createGuest()

      guard isVisitorWaiting else {
        finish(startingWrites: false)
        return nil
      }

      if guest == nil {
        fail(.unsaved)
      }

      return guest
    case .invalidYear:
      fail(.invalidYear)
      return nil
    case .belowMinimumAge(let minimumAge):
      refuse(minimumAge)
      return nil
    }
  }

  private func submitForAccount(_ year: Int) async {
    let result = await cache.mutate(invalidating: [.learningProfile]) { [api] identity in
      try await api.save(year, token: identity.bearerToken)
    }

    switch result {
    case .done(.accepted):
      summary.update {
        var answered = $0
        answered.needsBirthYear = false
        return answered
      }
    case .done(.invalidYear):
      fail(.invalidYear)
    case .done(.belowMinimumAge(let minimumAge)):
      refuse(minimumAge)
    case .failed:
      fail(.unsaved)
    case .obsolete:
      break
    }
  }

  private func refuse(_ minimumAge: Int) {
    defaults.set([Self.minimumAgeKey: minimumAge, Self.dateKey: now()], forKey: Self.refusalKey)
    refusal = (session.authenticatedSession, minimumAge)
    finish(startingWrites: false)
  }

  private func fail(_ failure: Failure) {
    notice = (session.authenticatedSession, failure)
  }

  /// A visitor who stopped waiting, or signed in meanwhile, is let go instead.
  private func failVisitor() {
    if isVisitorWaiting {
      fail(.unsaved)
    } else {
      finish(startingWrites: false)
    }
  }

  private func stopWaiting(_ id: UUID) {
    waitingWrites.removeValue(forKey: id)?.resume(returning: false)

    if waitingWrites.isEmpty, !isSaving {
      pendingGuest = nil
      notice = nil
    }
  }

  /// Ends every visitor's wait, and with it the guest nobody signed in.
  private func finish(startingWrites: Bool) {
    let writes = waitingWrites.values
    waitingWrites = [:]
    pendingGuest = nil
    notice = nil

    for write in writes {
      write.resume(returning: startingWrites)
    }
  }

  private static let refusalKey = "birthYear.refusal"
  private static let minimumAgeKey = "minimumAge"
  private static let dateKey = "refusedAt"
  private static let refusalDuration: TimeInterval = 24 * 60 * 60
}
