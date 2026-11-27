import Foundation
import Observation

@MainActor
@Observable
final class BuddyStore {
  let status: Resource<BuddyStatus>
  /// A goal's next page of conversations, while it loads or once it didn't.
  private(set) var nextConversations: [String: NextPageLoad] = [:]

  @ObservationIgnored private let api: any BuddyAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let saves: LearnerSaves
  @ObservationIgnored private var latestSave = 0
  @ObservationIgnored private var conversationLists: [String: Resource<BuddyConversations>] = [:]

  init(api: any BuddyAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    saves = LearnerSaves(cache: cache)

    status = cache.resource(
      audience: .signedIn, domains: [.goals, .learningProfile, .userProgress, .userSession]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.status(
        timeZone: TimeZone.current.identifier, token: session.bearerToken)
    }
  }

  /// The goal's conversations, the latest asked in first, with the one a visit opens.
  func conversations(goalId: String) -> Resource<BuddyConversations> {
    if let list = conversationLists[goalId] {
      return list
    }

    let api = api
    let list: Resource<BuddyConversations> = cache.resource(
      audience: .signedIn, domains: [.buddyConversations], isEmpty: \.conversations.isEmpty
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.conversations(goalId: goalId, cursor: nil, token: session.bearerToken)
    }

    conversationLists[goalId] = list
    return list
  }

  /// A conversation asked in since the first page moved to its top, so one already shown isn't
  /// added again.
  func loadMoreConversations(goalId: String) async {
    let list = conversations(goalId: goalId)

    guard case .loaded(let page) = list.state, let cursor = page.nextCursor,
      nextConversations[goalId] != .loading, let session = cache.session.authenticatedSession
    else {
      return
    }

    let revision = list.revision
    nextConversations[goalId] = .loading
    defer {
      if nextConversations[goalId] == .loading {
        nextConversations[goalId] = nil
      }
    }

    do {
      let next = try await api.conversations(
        goalId: goalId, cursor: cursor, token: session.bearerToken)

      guard list.revision == revision else {
        return
      }

      list.update { current in
        var shown = Set(current.conversations.map(\.id))
        var page = current
        page.conversations += next.conversations.filter { shown.insert($0.id).inserted }
        page.nextCursor = next.nextCursor
        return page
      }
    } catch APIError.unauthorized {
      await cache.session.expire(session)
    } catch {
      guard list.revision == revision, !(error is CancellationError) else {
        return
      }

      nextConversations[goalId] = .failed
    }
  }

  /// Saves even when the screen that asked goes away first. A failed save puts the buddy before
  /// back, and only the latest save can report a failure: false when it did.
  @discardableResult
  func save(_ choice: BuddyChoice) async -> Bool {
    guard choice.input != nil else { return false }
    latestSave += 1
    let request = latestSave
    let previous = status.value?.buddy
    status.update { status in
      var status = status
      status.buddy = .init(
        glasses: .init(rawValue: choice.glasses.rawValue) ?? .round,
        kind: .init(rawValue: choice.kind.rawValue) ?? .zu,
        name: choice.name,
        picked: true)
      return status
    }

    let result = await saves.save { [api, cache] in
      let result = await cache.mutate(invalidating: [.learningProfile]) { identity in
        try await api.save(choice, token: identity.bearerToken)
      }

      if request == self.latestSave, case .failed = result, let previous {
        self.status.update { status in
          var status = status
          status.buddy = previous
          return status
        }
      }

      return result
    }

    guard request == latestSave, case .failed = result else {
      return true
    }

    return false
  }

  /// Saves even when the screen that asked goes away first, which then gets `.obsolete`.
  func answer(_ insight: MemoryInsight, accepted: Bool) async -> MutationResult<MemoryInsight?> {
    await saves.save { [api, cache] in
      await cache.mutate(invalidating: [.goals, .learnerModel, .memory, .userSession]) { identity in
        try await api.answer(
          insightId: insight.id, accepted: accepted, quote: insight.planChange?.quote,
          token: identity.bearerToken)
      }
    }
  }
}

enum NextPageLoad: Equatable {
  case loading
  case failed
}
