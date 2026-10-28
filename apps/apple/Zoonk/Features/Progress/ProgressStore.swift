import Foundation
import Observation

@MainActor
@Observable
final class ProgressStore {
  let activity: Resource<ActivityProgress>
  let energy: Resource<EnergyProgress>
  let level: Resource<LevelProgress>
  let patterns: Resource<ScorePatterns>
  let score: Resource<ScoreProgress>

  init(api: any ProgressAPIClient, cache: AppCache) {
    func progress<Value: Equatable & Sendable>(
      _ load: @escaping (String) async throws -> Value?
    ) -> Resource<Value> {
      cache.resource(audience: .signedIn, domains: [.userProgress]) { session in
        guard let session else {
          return nil
        }

        return try await load(session.bearerToken)
      }
    }

    activity = progress { try await api.getActivity(token: $0) }
    energy = progress { try await api.getEnergy(token: $0) }
    level = progress { try await api.getLevel(token: $0) }
    patterns = progress { try await api.getScorePatterns(token: $0) }
    score = progress { try await api.getScore(token: $0) }
  }
}
