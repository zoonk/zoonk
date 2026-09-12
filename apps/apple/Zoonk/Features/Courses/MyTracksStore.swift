import Foundation
import Observation

@MainActor
@Observable
final class MyTracksStore {
  private(set) var items: [MyTrack] = []
  private(set) var nextCursor: String?
  private(set) var hasLoaded = false
  private(set) var isWorking = false
  private(set) var failure: MyCoursesFailure?
  private let api: any MyCoursesAPIClient
  private let session: SessionStore
  private var identity: AuthenticatedSession?
  private var revision = UUID()

  init(api: any MyCoursesAPIClient, session: SessionStore) {
    self.api = api
    self.session = session
  }

  func load(force: Bool = false, more: Bool = false) async {
    synchronizeSession()
    guard let current = session.authenticatedSession, !isWorking,
      more ? nextCursor != nil : force || !hasLoaded
    else { return }
    let request = UUID()
    revision = request
    isWorking = true
    failure = nil
    do {
      let page = try await api.listTracks(
        cursor: more ? nextCursor : nil, token: current.bearerToken)
      guard revision == request, session.authenticatedSession == current else {
        synchronizeSession()
        return
      }
      let existing = more ? items : []
      var seen = Set(existing.map(\.id))
      items = existing + page.tracks.filter { seen.insert($0.id).inserted }
      nextCursor = page.nextCursor
      hasLoaded = true
      isWorking = false
    } catch {
      guard revision == request, session.authenticatedSession == current else {
        synchronizeSession()
        return
      }
      isWorking = false
      guard !(error is CancellationError) else { return }
      if error as? MyCoursesAPIError == .unauthorized {
        await session.expire(current)
        synchronizeSession()
      } else {
        failure = error as? MyCoursesAPIError == .network ? .network : .unavailable
      }
    }
  }

  private func synchronizeSession() {
    guard identity != session.authenticatedSession else { return }
    identity = session.authenticatedSession
    revision = UUID()
    items = []
    nextCursor = nil
    hasLoaded = false
    isWorking = false
    failure = nil
  }
}
