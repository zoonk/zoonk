import Foundation
import Observation

enum ProgressFailure: Equatable, Sendable {
  case network
  case unavailable
}

enum ProgressLoadState<Value: Equatable & Sendable>: Equatable, Sendable {
  case idle
  case loading
  case loaded(Value)
  case empty
  case failed(ProgressFailure)
}

private struct ProgressRequest<Value: Equatable & Sendable>: Sendable {
  let isEmpty: @Sendable (Value) -> Bool
  let load: @Sendable (any ProgressAPIClient, String) async throws -> Value?
}

private enum ProgressResource: Hashable, Sendable {
  case activity
  case energy
  case level
  case overview
  case patterns
  case score
}

private struct ProgressRequestIdentity: Sendable {
  let resource: ProgressResource
  let revision: UUID
}

@MainActor
@Observable
final class ProgressStore {
  private(set) var activityState: ProgressLoadState<ActivityProgress> = .idle
  private(set) var energyState: ProgressLoadState<EnergyProgress> = .idle
  private(set) var levelState: ProgressLoadState<LevelProgress> = .idle
  private(set) var overviewState: ProgressLoadState<ProgressOverview> = .idle
  private(set) var patternsState: ProgressLoadState<ScorePatterns> = .idle
  private(set) var scoreState: ProgressLoadState<ScoreProgress> = .idle

  private let api: any ProgressAPIClient
  private let session: SessionStore
  private var sessionIdentity: AuthenticatedSession?
  private var requestRevisions: [ProgressResource: UUID] = [:]

  init(api: any ProgressAPIClient, session: SessionStore) {
    self.api = api
    self.session = session
    sessionIdentity = session.authenticatedSession
  }

  func loadOverview(force: Bool = false) async {
    synchronizeSession()

    guard canBeginRequest(state: overviewState, force: force) else {
      return
    }

    let requestIdentity = beginRequest(for: .overview)
    overviewState = loadingState(from: overviewState)
    let state = await load(
      ProgressRequest(
        isEmpty: { $0.isEmpty },
        load: { api, token in try await api.getOverview(token: token) }))

    guard isCurrent(requestIdentity) else {
      return
    }

    overviewState = state
  }

  func loadActivity(force: Bool = false) async {
    synchronizeSession()

    guard canBeginRequest(state: activityState, force: force) else {
      return
    }

    let requestIdentity = beginRequest(for: .activity)
    activityState = loadingState(from: activityState)
    let state = await load(
      ProgressRequest(
        isEmpty: { $0.isEmpty },
        load: { api, token in try await api.getActivity(token: token) }))

    guard isCurrent(requestIdentity) else {
      return
    }

    activityState = state
  }

  func loadEnergy(force: Bool = false) async {
    synchronizeSession()

    guard canBeginRequest(state: energyState, force: force) else {
      return
    }

    let requestIdentity = beginRequest(for: .energy)
    energyState = loadingState(from: energyState)
    let state = await load(
      ProgressRequest(
        isEmpty: { _ in false },
        load: { api, token in try await api.getEnergy(token: token) }))

    guard isCurrent(requestIdentity) else {
      return
    }

    energyState = state
  }

  func loadLevel(force: Bool = false) async {
    synchronizeSession()

    guard canBeginRequest(state: levelState, force: force) else {
      return
    }

    let requestIdentity = beginRequest(for: .level)
    levelState = loadingState(from: levelState)
    let state = await load(
      ProgressRequest(
        isEmpty: { _ in false },
        load: { api, token in try await api.getLevel(token: token) }))

    guard isCurrent(requestIdentity) else {
      return
    }

    levelState = state
  }

  func loadScore(force: Bool = false) async {
    synchronizeSession()

    guard canBeginRequest(state: scoreState, force: force) else {
      return
    }

    let requestIdentity = beginRequest(for: .score)
    scoreState = loadingState(from: scoreState)
    let state = await load(
      ProgressRequest(
        isEmpty: { _ in false },
        load: { api, token in try await api.getScore(token: token) }))

    guard isCurrent(requestIdentity) else {
      return
    }

    scoreState = state
  }

  func loadPatterns(force: Bool = false) async {
    synchronizeSession()

    guard canBeginRequest(state: patternsState, force: force) else {
      return
    }

    let requestIdentity = beginRequest(for: .patterns)
    patternsState = loadingState(from: patternsState)
    let state = await load(
      ProgressRequest(
        isEmpty: { _ in false },
        load: { api, token in try await api.getScorePatterns(token: token) }))

    guard isCurrent(requestIdentity) else {
      return
    }

    patternsState = state
  }

  private func beginRequest(for resource: ProgressResource) -> ProgressRequestIdentity {
    let requestIdentity = ProgressRequestIdentity(resource: resource, revision: UUID())
    requestRevisions[resource] = requestIdentity.revision
    return requestIdentity
  }

  private func isCurrent(_ requestIdentity: ProgressRequestIdentity) -> Bool {
    requestRevisions[requestIdentity.resource] == requestIdentity.revision
  }

  private func load<Value>(_ request: ProgressRequest<Value>) async -> ProgressLoadState<Value> {
    guard let authenticatedSession = session.authenticatedSession else {
      return .idle
    }

    do {
      let value = try await request.load(api, authenticatedSession.bearerToken)

      guard session.authenticatedSession == authenticatedSession else {
        synchronizeSession()
        return .idle
      }

      guard let value, !request.isEmpty(value) else {
        return .empty
      }

      return .loaded(value)
    } catch is CancellationError {
      return .idle
    } catch ProgressAPIError.unauthorized {
      await session.expire(authenticatedSession)
      synchronizeSession()
      return .idle
    } catch ProgressAPIError.network {
      return session.authenticatedSession == authenticatedSession ? .failed(.network) : .idle
    } catch {
      return session.authenticatedSession == authenticatedSession ? .failed(.unavailable) : .idle
    }
  }

  private func synchronizeSession() {
    let currentSessionIdentity = session.authenticatedSession

    guard currentSessionIdentity != sessionIdentity else {
      return
    }

    sessionIdentity = currentSessionIdentity
    requestRevisions.removeAll()
    activityState = .idle
    energyState = .idle
    levelState = .idle
    overviewState = .idle
    patternsState = .idle
    scoreState = .idle
  }

  private func canBeginRequest<Value>(
    state: ProgressLoadState<Value>,
    force: Bool
  ) -> Bool {
    force || state != .loading
  }

  private func loadingState<Value>(
    from state: ProgressLoadState<Value>
  ) -> ProgressLoadState<Value> {
    switch state {
    case .loaded, .empty:
      state
    case .idle, .loading, .failed:
      .loading
    }
  }
}
