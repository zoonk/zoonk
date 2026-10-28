import SwiftUI

extension PracticeHooks {
  /// Where practice screens lead, opened by the shell's router. The Ask button, a challenge's
  /// call and milestone ceremonies join here as the buddy, voice and milestones lanes land.
  static func routed(by router: AppRouter) -> PracticeHooks {
    PracticeHooks(navigate: { destination in
      switch destination {
      case .lesson(let lessonId):
        router.open(.lesson(lessonId: lessonId))
      case .mistakePractice(let skillId):
        router.open(.mistakePractice(skillId: skillId))
      case .pattern(let patternId):
        router.open(.pattern(patternId: patternId))
      case .checkpoint(let blockId, let sessionId):
        router.open(.checkpoint(blockId: blockId, sessionId: sessionId))
      case .challenge(let planItemId, let sessionId):
        router.open(.challenge(planItemId: planItemId, sessionId: sessionId))
      case .mock(let blockId, let sessionId):
        router.open(.mock(blockId: blockId, sessionId: sessionId))
      case .subscription:
        router.present(.subscription)
      }
    })
  }
}

extension LessonPlayerRoutes {
  /// The player's Plus lock and sign-up refusals open the shell's sheets over the lesson, which
  /// stays where the learner was.
  static func routed(by router: AppRouter) -> LessonPlayerRoutes {
    LessonPlayerRoutes(
      showPlus: { router.present(.subscription) },
      signIn: { router.present(.account) })
  }
}
