import Foundation

enum AppRoute: Hashable, Identifiable {
  case subject(subjectKey: String)
  case chapter(chapterId: String)
  case languageUnit(chapterId: String)
  case mindMaps
  case exam
  case mockChooser
  case mistakes
  case speaking
  case earlierQuestions
  case statistics
  case catalog
  case course(courseId: String, title: String)

  case session
  case logbook
  case lesson(lessonId: String, sessionId: String? = nil)
  case questionBlock(sessionId: String, blockId: String)
  case mistakePractice(skillId: String? = nil)
  case pattern(patternId: String)
  case testOut(chapterId: String)
  case focusTest(goalId: String)
  case challenge(planItemId: String, sessionId: String? = nil)
  case checkpoint(blockId: String, sessionId: String? = nil)
  case essay(blockId: String)
  case mock(blockId: String, sessionId: String? = nil)
  case placementMock(goalId: String)
  case mindMap(chapterId: String)
  case pronunciation(goalId: String? = nil)
  case conversation(conversationId: String)
  /// `goal` only fills the box: reading the words waits for the learner's tap. `draftId` opens a
  /// goal typed before and not confirmed yet.
  case startGoal(goal: String? = nil, draftId: String? = nil)
  case goalSetup(goalId: String)
  case courseStart(courseId: String, chapterId: String? = nil)
  case explain(goalId: String)
  case planLink(planId: String)

  enum Presentation {
    case push
    case task
  }

  enum Requirement {
    case none
    case account
    case goal
  }

  var id: Self { self }

  var presentation: Presentation {
    switch self {
    case .subject, .chapter, .languageUnit, .mindMaps, .exam, .mockChooser, .mistakes, .speaking,
      .earlierQuestions, .statistics, .catalog, .course:
      .push
    default:
      .task
    }
  }

  /// The catalog has its own signed-out view, and task screens bring their own gates (main's
  /// `AuthGateScreen`).
  var requirement: Requirement {
    switch self {
    case .subject, .mindMaps, .exam, .mockChooser, .mistakes, .speaking:
      .goal
    case .chapter, .languageUnit, .earlierQuestions, .statistics:
      .account
    default:
      .none
    }
  }

  var studyTab: AppTab? {
    AppTab.study.first { $0.studyRoute == self }
  }
}
