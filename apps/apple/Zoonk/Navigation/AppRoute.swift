import Foundation

/// Every place a feature opens another feature's screen. Push routes stack on the current tab;
/// task routes are main's full-screen pages (no tabs around them) and cover everything.
/// `ROUTES.md` in the lane notes is the contract each feature's `<Thing>Screen` follows.
enum AppRoute: Hashable, Identifiable {
  // Pushes
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

  // Full-screen tasks
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
  case startGoal
  case goalSetup(goalId: String)
  case courseStart(courseId: String, chapterId: String? = nil)
  case explain(goalId: String)
  case planLink(planId: String)

  enum Presentation {
    case push
    case task
  }

  /// What a screen needs before it can show anything of its own; the shell gates the rest.
  enum Requirement {
    case none
    case account
    case goal
  }

  var id: Self { self }

  var presentation: Presentation {
    switch self {
    case .subject, .chapter, .languageUnit, .mindMaps, .exam, .mockChooser, .mistakes, .speaking,
      .earlierQuestions, .statistics, .catalog:
      .push
    default:
      .task
    }
  }

  /// Main's gates for pushed pages: goal pages show "Start with a goal" without one, and a
  /// visitor is asked to log in. Statistics and the catalog have their own signed-out views, and
  /// task screens bring their own gates (main's `AuthGateScreen`).
  var requirement: Requirement {
    switch self {
    case .subject, .chapter, .languageUnit, .mindMaps, .exam, .mockChooser, .mistakes, .speaking:
      .goal
    case .earlierQuestions:
      .account
    default:
      .none
    }
  }

  /// The Study place a push stands for, so opening it where the sidebar shows that place
  /// doesn't stack a second copy on it.
  var studyTab: AppTab? {
    AppTab.study.first { $0.studyRoute == self }
  }
}
