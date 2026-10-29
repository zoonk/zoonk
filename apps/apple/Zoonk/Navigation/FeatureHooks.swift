import SwiftUI

extension PracticeHooks {
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
        AnyView(
          TutorAskButton(
            scope: .item(
              itemId: target.itemId, blockId: target.blockId, answered: target.answered,
              missed: target.missed),
            quote: target.question))
      },
      checkpointCall: { blockId, _ in
        AnyView(ConversationScreen(checkpointBlockId: blockId))
      },
      ceremony: { milestone, onClose in
        AnyView(MilestoneCeremony(milestone: Milestone(milestone), onClose: onClose))
      })
  }
}

extension TutorPlaces {
  static func routed(by router: AppRouter) -> TutorPlaces {
    TutorPlaces { place in
      switch place {
      case .account:
        router.present(.signIn)
      case .memory:
        router.present(.account)
      case .subscription:
        router.present(.subscription)
      case .startGoal:
        router.open(.startGoal())
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
        case .case1(let block):
          router.open(blockID: block.blockId)
        case .case7(let area):
          router.open(.chapter(chapterId: area.areaId))
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
  static func routed(by router: AppRouter) -> LessonPlayerRoutes {
    LessonPlayerRoutes(
      signIn: { router.present(.signIn) },
      startCourse: { courseId, chapterId in
        router.open(.courseStart(courseId: courseId, chapterId: chapterId))
      },
      startGoal: { goal in router.open(.startGoal(goal: goal)) })
  }
}
