import SwiftUI

extension PracticeHooks {
  /// Where practice screens lead, opened by the shell's router. The Ask button, a challenge's
  /// call and milestone ceremonies join here as the buddy, voice and milestones lanes land.
  static func routed(by router: AppRouter) -> PracticeHooks {
    PracticeHooks(
      navigate: { destination in
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
      },
      askButton: { target in
        // The target says whether the answer was missed, not whether it was checked yet.
        AnyView(
          TutorAskButton(
            scope: .item(
              itemId: target.itemId, blockId: nil, answered: target.missed, missed: target.missed),
            quote: target.question))
      })
  }
}

extension TutorPlaces {
  /// Where the buddy sends the learner: an account or Plus when a limit asks for one, the app
  /// places its answers offer, and the Buddy tab's links.
  static func routed(by router: AppRouter) -> TutorPlaces {
    TutorPlaces { place in
      switch place {
      case .account, .memory:
        router.present(.account)
      case .subscription:
        router.present(.subscription)
      case .startGoal:
        router.open(.startGoal)
      case .chapterTest(let chapterId):
        router.open(.testOut(chapterId: chapterId))
      case .chooseFocus:
        router.select(.plan)
      case .languageUnit(let chapterId):
        router.open(.languageUnit(chapterId: chapterId))
      case .mockChooser:
        router.open(.mockChooser)
      case .subject(let subjectKey):
        router.open(.subject(subjectKey: subjectKey))
      case .mistakes:
        router.open(.mistakes)
      case .pronunciation(let goalId):
        router.open(.pronunciation(goalId: goalId))
      case .statistics, .energy:
        router.open(.statistics)
      case .logbook:
        router.open(.logbook)
      case .earlierQuestions:
        router.open(.earlierQuestions)
      case .mission(let opens):
        switch opens {
        case .case1, .case7:
          router.open(.session)
        case .case2:
          router.open(.mistakePractice())
        case .case3(let pattern):
          router.open(.pattern(patternId: pattern.patternId))
        case .case4:
          router.open(.pronunciation())
        case .case5(let call):
          router.open(.languageUnit(chapterId: call.chapterId))
        case .case6:
          router.select(.buddy)
        case .case8:
          router.open(.mockChooser)
        }
      }
    }
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
