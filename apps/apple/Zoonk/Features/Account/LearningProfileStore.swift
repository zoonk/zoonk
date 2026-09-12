import Foundation
import Observation

@MainActor
@Observable
final class LearningProfileStore {
  private var suggestedInterests: [String] = []
  var customInterestsText = ""
  var text: String {
    get {
      (suggestedInterests + [customInterestsText]).filter { !$0.isEmpty }.joined(separator: "\n")
    }
    set {
      let values = Self.parse(newValue)
      suggestedInterests = values.filter { value in
        LearningInterestSuggestion.allCases.contains { $0.matches(value) }
      }
      customInterestsText = values.filter { value in
        !LearningInterestSuggestion.allCases.contains { $0.matches(value) }
      }.joined(separator: "\n")
    }
  }
  private(set) var isLoaded = false
  private(set) var isWorking = false
  private(set) var failure: LearningProfileFailure?
  private var identity: AuthenticatedSession?
  private var revision = UUID()
  private let api: any LearningProfileAPIClient

  init(api: any LearningProfileAPIClient) { self.api = api }

  func includes(_ suggestion: LearningInterestSuggestion) -> Bool {
    suggestedInterests.contains(where: suggestion.matches)
  }

  func set(_ suggestion: LearningInterestSuggestion, selected: Bool) {
    if selected {
      if !includes(suggestion) {
        suggestedInterests.append(suggestion.rawValue)
      }
    } else {
      suggestedInterests.removeAll(where: suggestion.matches)
    }
  }

  private var interestValues: [String] {
    Self.parse(text)
  }

  private static func parse(_ text: String) -> [String] {
    text.split(whereSeparator: \.isNewline).map {
      $0.trimmingCharacters(in: .whitespacesAndNewlines)
    }.filter { !$0.isEmpty }
  }

  func load(session: SessionStore, force: Bool = false) async {
    let current = session.authenticatedSession
    if identity != current {
      identity = current
      revision = UUID()
      text = ""
      isLoaded = false
      isWorking = false
      failure = nil
    }
    guard let current, !isWorking, force || !isLoaded else { return }
    let request = UUID()
    revision = request
    isWorking = true
    failure = nil
    do {
      let interests = try await api.getInterests(token: current.bearerToken)
      guard revision == request, session.authenticatedSession == current else { return }
      text = interests.joined(separator: "\n")
      isLoaded = true
      isWorking = false
    } catch {
      await finish(error: error, request: request, identity: current, session: session)
    }
  }

  func save(session: SessionStore) async -> Bool {
    guard let current = session.authenticatedSession, current == identity, isLoaded, !isWorking
    else { return false }
    let values = interestValues
    let request = UUID()
    revision = request
    isWorking = true
    failure = nil
    do {
      let saved = try await api.updateInterests(values, token: current.bearerToken)
      guard revision == request, session.authenticatedSession == current else { return false }
      text = saved.joined(separator: "\n")
      isWorking = false
      return true
    } catch {
      await finish(error: error, request: request, identity: current, session: session)
      return false
    }
  }

  private func finish(
    error: Error, request: UUID, identity: AuthenticatedSession, session: SessionStore
  ) async {
    guard revision == request, session.authenticatedSession == identity else { return }
    isWorking = false
    guard !(error is CancellationError) else { return }
    failure = error as? LearningProfileFailure ?? .unavailable
    if failure == .unauthorized { await session.expire(identity) }
  }
}
