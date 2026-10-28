#if DEBUG
  import Foundation

  /// Mind maps from `ZOONK_UI_TEST_MIND_MAPS` (a goal's maps as `GET /v1/goals/{goalId}/mind-maps`
  /// returns them, with each map's outline): the gallery lists them for any goal, a chapter's map
  /// opens from them, and a tap to make one answers at once without generating anything.
  struct UITestMindMapsAPI: MindMapsAPIClient {
    let maps: GoalMindMaps

    init?(environment: [String: String]) {
      guard let json = environment["ZOONK_UI_TEST_MIND_MAPS"] else {
        return nil
      }

      do {
        maps = try JSONDecoder().decode(GoalMindMaps.self, from: Data(json.utf8))
      } catch {
        preconditionFailure("ZOONK_UI_TEST_MIND_MAPS must contain a goal's mind maps")
      }
    }

    func list(token: String, goalId: String) async throws -> GoalMindMaps {
      maps
    }

    func map(token: String, goalId: String, chapterId: String) async throws -> ChapterMindMap {
      guard
        let map = maps.chapters.first(where: { $0.chapterId == chapterId }) ?? maps.chapters.first
      else {
        throw APIError.notFound
      }

      return map
    }

    func status(token: String, goalId: String, chapterId: String) async throws
      -> ChapterMindMap.Status
    {
      .ready
    }

    func create(token: String, goalId: String, chapterId: String) async throws -> Bool {
      true
    }
  }
#endif
