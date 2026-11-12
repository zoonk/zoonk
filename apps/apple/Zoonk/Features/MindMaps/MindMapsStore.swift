import Foundation
import Observation

/// Nothing is made on a screen's load: only a learner's tap asks for a map.
@MainActor
@Observable
final class MindMapsStore {
  private(set) var requesting: Set<String> = []
  private(set) var failures: [String: MindMapRequestFailure] = [:]
  /// The read count when each failure appeared, by map key or, for Create all, by goal; a read
  /// started after it clears it.
  @ObservationIgnored private var failedAt: [String: Int] = [:]
  @ObservationIgnored private var reads = 0

  @ObservationIgnored private let api: any MindMapsAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let drawingPoll: Duration
  @ObservationIgnored private let writingPoll: Duration
  @ObservationIgnored private let positions: MindMapPositions
  @ObservationIgnored private var lists: [String: Resource<GoalMindMaps>] = [:]
  @ObservationIgnored private var maps: [String: Resource<ChapterMindMap>] = [:]
  @ObservationIgnored private var lessons: [String: Resource<ChapterLessonMaps>] = [:]

  /// What each learner asked for while it saves: shown at once, and dropped once the save is done
  /// or failed, when the maps read say again.
  private(set) var pendingSaves: [PendingSave: Bool] = [:]
  private(set) var saveFailure: SaveFailure?
  /// Goals whose "Create all chapter maps" is on its way.
  private(set) var creatingAll: Set<String> = []
  private(set) var createAllFailures: [String: MindMapRequestFailure] = [:]

  init(
    api: any MindMapsAPIClient, cache: AppCache, drawingPoll: Duration = .seconds(4),
    writingPoll: Duration = .seconds(15), positions: MindMapPositions = MindMapPositions()
  ) {
    self.positions = positions
    self.api = api
    self.cache = cache
    self.drawingPoll = drawingPoll
    self.writingPoll = writingPoll
  }

  func list(goalId: String) -> Resource<GoalMindMaps> {
    if let list = lists[goalId] {
      return list
    }

    let api = api
    let list: Resource<GoalMindMaps> = cache.resource(
      audience: .signedIn, domains: [.goals, .savedMindMaps, .userProgress, .userSubscription],
      isEmpty: \.isEmpty
    ) { [weak self] session in
      guard let session else {
        return nil
      }

      let started = self?.readStarted()
      let read = try await api.list(token: session.bearerToken, goalId: goalId)
      self?.readCameThrough(
        started, keys: [goalId] + read.chapters.map { "\(goalId):\($0.chapterId)" })
      self?.listed(read, goalId: goalId)
      return read
    }

    lists[goalId] = list
    return list
  }

  func map(goalId: String, chapterId: String) -> Resource<ChapterMindMap> {
    let key = "\(goalId):\(chapterId)"

    if let map = maps[key] {
      return map
    }

    let api = api
    let map: Resource<ChapterMindMap> = cache.resource(
      audience: .signedIn, domains: [.goals, .savedMindMaps, .userProgress, .userSubscription]
    ) { [weak self] session in
      guard let session else {
        return nil
      }

      let started = self?.readStarted()
      let read = try await api.map(
        token: session.bearerToken, goalId: goalId, chapterId: chapterId)
      self?.readCameThrough(started, keys: [key])
      return read
    }

    maps[key] = map
    return map
  }

  func lessonMaps(goalId: String, chapterId: String) -> Resource<ChapterLessonMaps> {
    let key = "\(goalId):\(chapterId)"

    if let resource = lessons[key] {
      return resource
    }

    let api = api
    let resource: Resource<ChapterLessonMaps> = cache.resource(
      audience: .signedIn, domains: [.goals, .savedMindMaps, .userProgress, .userSubscription]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.lessonMaps(
        token: session.bearerToken, goalId: goalId, chapterId: chapterId)
    }

    lessons[key] = resource
    return resource
  }

  /// Where this learner last was in the goal's tab, on this device.
  func position(goalId: String, tab: GoalMindMaps.Tab) -> MindMapPosition? {
    guard let userId = cache.session.account?.user.id else {
      return nil
    }

    return positions.position(userId: userId, goalId: goalId, tab: tab)
  }

  func remember(_ position: MindMapPosition?, goalId: String, tab: GoalMindMaps.Tab) {
    guard let userId = cache.session.account?.user.id else {
      return
    }

    positions.save(position, userId: userId, goalId: goalId, tab: tab)
  }

  /// `server` is what the maps read last says.
  func isSaved(_ key: MindMapKey, server: Bool) -> Bool {
    guard let session = cache.session.authenticatedSession else {
      return server
    }

    return pendingSaves[PendingSave(session: session, key: key)] ?? server
  }

  /// Shown at once. Taps faster than the saves end in the last one asked for; a failure goes back
  /// to what the maps read says and says so. Not `QueuedSaves`: the server takes the state wanted,
  /// so only each map's last tap is sent, and a map saves where the goal's list isn't read, such as
  /// the chapter's map viewer.
  func setSaved(_ saved: Bool, target: SaveTarget, goalId: String) {
    guard let session = cache.session.authenticatedSession else {
      return
    }

    let pending = PendingSave(session: session, key: target.key)
    let isSaving = pendingSaves[pending] != nil
    pendingSaves[pending] = saved

    if saveFailure?.key == target.key {
      saveFailure = nil
    }

    guard !isSaving else {
      return
    }

    Task {
      await save(pending, target: target, goalId: goalId)
    }
  }

  /// Hidden once the session it was made for changes.
  func saveFailed(goalId: String) -> Bool {
    guard let saveFailure else {
      return false
    }

    return saveFailure.goalId == goalId
      && saveFailure.session == cache.session.authenticatedSession
  }

  func dismissSaveFailure() {
    saveFailure = nil
  }

  /// Starts every chapter map one tap can start; what it couldn't start shows in the list read
  /// again.
  func createAll(goalId: String) async {
    guard !creatingAll.contains(goalId) else {
      return
    }

    creatingAll.insert(goalId)
    defer { creatingAll.remove(goalId) }
    failCreateAll(nil, goalId: goalId)

    let api = api
    let started = await cache.mutate { identity in
      try await api.createAll(token: identity.bearerToken, goalId: goalId)
    }

    switch started {
    case .done:
      if await !Self.reread(lists[goalId]) {
        failCreateAll(.unreachable, goalId: goalId)
      }
    case .failed:
      failCreateAll(.unreachable, goalId: goalId)
    case .obsolete:
      break
    }
  }

  /// One follower for the whole list while any of its maps is on its way: every map's row reads the
  /// list it refreshes. It ends once nothing is on its way, or when the screen goes.
  func followList(goalId: String) async {
    while let list = lists[goalId], let value = list.value,
      value.chapters.contains(where: \.status.isOnItsWay)
    {
      let beat =
        value.chapters.contains { $0.status == .drawing } ? drawingPoll : writingPoll

      do {
        try await Task.sleep(for: beat)
      } catch {
        return
      }

      await list.refresh()
    }
  }

  func failure(goalId: String, chapterId: String) -> MindMapRequestFailure? {
    failures["\(goalId):\(chapterId)"]
  }

  func create(goalId: String, chapterId: String) async {
    guard !requesting.contains(chapterId) else {
      return
    }

    requesting.insert(chapterId)
    defer { requesting.remove(chapterId) }
    fail(nil, goalId: goalId, chapterId: chapterId)

    let api = api
    let started = await cache.mutate { identity in
      try await api.create(token: identity.bearerToken, goalId: goalId, chapterId: chapterId)
    }

    switch started {
    case .done(.read):
      if await !refresh(goalId: goalId, chapterId: chapterId) {
        fail(.unreachable, goalId: goalId, chapterId: chapterId)
      }
    case .done(.refused(let limit)):
      fail(.refused(limit), goalId: goalId, chapterId: chapterId)
    case .failed:
      fail(.unreachable, goalId: goalId, chapterId: chapterId)
    case .obsolete:
      break
    }
  }

  /// Only reads, never asks for the map again, and never gives up on a run on its own: writing the
  /// lessons can take minutes, and the server fails a run that stops reporting. It ends once what's
  /// shown of the map says where the run stands and the run is done. Leaving the screen or signing
  /// out ends it sooner, and three beats in a row whose reads don't come through end it as
  /// `unreachable`.
  func follow(goalId: String, chapterId: String) async {
    guard let session = cache.session.authenticatedSession else {
      return
    }

    var missed = 0

    while cache.session.authenticatedSession == session {
      var beat = drawingPoll

      do {
        let read = try await api.status(
          token: session.bearerToken, goalId: goalId, chapterId: chapterId)
        var isRead = shows(read, goalId: goalId, chapterId: chapterId)

        if !isRead {
          isRead = await refresh(goalId: goalId, chapterId: chapterId)
        }

        if isRead {
          missed = 0

          if !read.isOnItsWay, shows(read, goalId: goalId, chapterId: chapterId) {
            return
          }

          beat = read == .writingLessons ? writingPoll : drawingPoll
        } else {
          missed += 1
        }
      } catch APIError.network, APIError.unavailable {
        missed += 1
      } catch {
        // Cancelled, or an answer reading again won't change.
        return
      }

      if missed == 3 {
        if !Task.isCancelled, cache.session.authenticatedSession == session {
          fail(.unreachable, goalId: goalId, chapterId: chapterId)
        }

        return
      }

      do {
        try await Task.sleep(for: beat)
      } catch {
        return
      }
    }
  }

  private func save(_ pending: PendingSave, target: SaveTarget, goalId: String) async {
    let key = pending.key
    var sent: Bool?

    while let wanted = pendingSaves[pending], wanted != sent {
      let api = api
      let result: MutationResult<Bool> =
        cache.session.authenticatedSession == pending.session
        ? await cache.mutate { identity in
          try await api.save(token: identity.bearerToken, goalId: goalId, key: key, saved: wanted)
        } : .obsolete

      switch result {
      case .done(let saved):
        sent = saved
        show(saved, target: target, goalId: goalId)
      case .failed:
        pendingSaves[pending] = nil
        saveFailure = SaveFailure(goalId: goalId, key: key, session: pending.session)
      case .obsolete:
        pendingSaves[pending] = nil
        return
      }
    }

    pendingSaves[pending] = nil

    // A save the server took is the learner's in every goal whose maps hold it, a later tap's
    // failure included, and the Saved tab lists saves in syllabus order, which only the server
    // knows.
    if sent != nil {
      cache.invalidate([.savedMindMaps])
    }
  }

  /// Every copy of the map read so far says it, so dropping the pending save changes nothing shown.
  private func show(_ saved: Bool, target: SaveTarget, goalId: String) {
    let key = target.key

    lists[goalId]?.update { list in
      var entries = list.saved.filter { $0.key != key }

      if saved {
        entries.insert(
          SavedMindMap(
            available: true, chapterId: target.chapterId, kind: key.kind,
            targetId: key.targetId, title: target.title),
          at: entries.firstIndex { !$0.available } ?? entries.endIndex)
      }

      return GoalMindMaps(
        chapters: list.chapters.map {
          key.kind == .chapter && $0.chapterId == key.targetId ? $0.saving(saved) : $0
        },
        createOffer: list.createOffer, firstTab: list.firstTab, lessonGroups: list.lessonGroups,
        saved: entries)
    }

    switch key.kind {
    case .chapter:
      maps["\(goalId):\(key.targetId)"]?.update { $0.saving(saved) }
    case .lesson:
      for (id, resource) in lessons where id.hasPrefix("\(goalId):") {
        guard resource.value?.lessons.contains(where: { $0.lessonId == key.targetId }) == true
        else {
          continue
        }

        resource.update { maps in
          ChapterLessonMaps(
            chapter: maps.chapter,
            lessons: maps.lessons.map { $0.lessonId == key.targetId ? $0.saving(saved) : $0 })
        }
      }
    }
  }

  private func fail(_ failure: MindMapRequestFailure?, goalId: String, chapterId: String) {
    let key = "\(goalId):\(chapterId)"
    failures[key] = failure
    failedAt[key] = failure == nil ? nil : reads
  }

  private func failCreateAll(_ failure: MindMapRequestFailure?, goalId: String) {
    createAllFailures[goalId] = failure
    failedAt[goalId] = failure == nil ? nil : reads
  }

  /// What a list read shows that the list didn't before marks that chapter's reads stale, one still
  /// on its way included, since it may predate the change: its map once the map moved on (Create all
  /// started it, or the list's follower saw it drawn; only a single map's tap reads both), and its
  /// lesson maps once more of its lessons show (a map's run wrote them; the reader's deck takes them
  /// from the list). Only a change does, so the follower's beats don't restart a read on its way.
  private func listed(_ read: GoalMindMaps, goalId: String) {
    let before = lists[goalId]?.value

    for chapter in read.chapters
    where before?.chapter(chapter.chapterId)?.status != chapter.status {
      maps["\(goalId):\(chapter.chapterId)"]?.invalidate()
    }

    for group in read.lessonGroups {
      let shown = before?.lessonGroups.first { $0.chapterId == group.chapterId }?.lessonIds ?? []

      if !Set(shown).isSuperset(of: group.lessonIds) {
        lessons["\(goalId):\(group.chapterId)"]?.invalidate()
      }
    }
  }

  private func readStarted() -> Int {
    reads += 1
    return reads
  }

  private func readCameThrough(_ started: Int?, keys: [String]) {
    guard let started else {
      return
    }

    for key in keys where (failedAt[key] ?? started) < started {
      failures[key] = nil
      createAllFailures[key] = nil
      failedAt[key] = nil
    }
  }

  /// Whether every copy of the map read so far, in the list and on its own, says `status`.
  private func shows(_ status: ChapterMindMap.Status, goalId: String, chapterId: String) -> Bool {
    let listed = lists[goalId]?.value?.chapters.first { $0.chapterId == chapterId }
    let map = maps["\(goalId):\(chapterId)"]?.value

    return [listed, map].allSatisfy { $0 == nil || $0?.status == status }
  }

  /// Reads again only the copies of the map already read; one not read yet loads fresh when shown.
  /// False when a read didn't come through.
  private func refresh(goalId: String, chapterId: String) async -> Bool {
    async let list = Self.reread(lists[goalId])
    async let map = Self.reread(maps["\(goalId):\(chapterId)"])
    let (listed, read) = await (list, map)
    return listed && read
  }

  private static func reread<Value>(_ resource: Resource<Value>?) async -> Bool {
    guard let resource, resource.value != nil else {
      return true
    }

    let revision = resource.revision
    await resource.refresh()
    return resource.revision != revision
  }
}

/// A map to save, with what the Saved tab shows of it before the list is read again.
struct SaveTarget: Equatable, Sendable {
  let key: MindMapKey
  let title: String
  let chapterId: String?
}

struct PendingSave: Hashable, Sendable {
  let session: AuthenticatedSession
  let key: MindMapKey
}

struct SaveFailure: Equatable, Sendable {
  let goalId: String
  let key: MindMapKey
  let session: AuthenticatedSession
}
