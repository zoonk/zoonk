import Foundation
import Observation

/// The signed-in learner's statistics, each kept for the app's lifetime and revalidated when a
/// mutation changes their progress.
@MainActor
@Observable
final class ProgressStore {
  let activity: Resource<ActivityProgress>
  let energy: Resource<EnergyProgress>
  let level: Resource<LevelProgress>
  let overview: Resource<ProgressOverview>
  let patterns: Resource<ScorePatterns>
  let score: Resource<ScoreProgress>

  init(api: any ProgressAPIClient, cache: AppCache) {
    func progress<Value: Equatable & Sendable>(
      isEmpty: @escaping (Value) -> Bool = { _ in false },
      _ load: @escaping (String) async throws -> Value?
    ) -> Resource<Value> {
      cache.resource(audience: .signedIn, domains: [.userProgress], isEmpty: isEmpty) { session in
        guard let session else {
          return nil
        }

        return try await load(session.bearerToken)
      }
    }

    activity = progress(isEmpty: \.isEmpty) { try await api.getActivity(token: $0) }
    energy = progress { try await api.getEnergy(token: $0) }
    level = progress { try await api.getLevel(token: $0) }
    overview = progress(isEmpty: \.isEmpty) { try await api.getOverview(token: $0) }
    patterns = progress { try await api.getScorePatterns(token: $0) }
    score = progress { try await api.getScore(token: $0) }
  }
}
