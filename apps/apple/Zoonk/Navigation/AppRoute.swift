import Foundation

enum AppRoute: Hashable, Identifiable {
  case subject(subjectKey: String)
  case chapter(chapterId: String)
  case languageUnit(chapterId: String)
  /// `subjectKey` opens it at that subject's maps.
  case mindMaps(subjectKey: String? = nil)
  case exam
  case mockChooser
  case mistakes
  case completedLessons
  case speaking
  case earlierQuestions
  /// `section` opens that statistics page beside the overview where the window has room.
  case statistics(section: StatsSection? = nil)
  case certificates
  case certificate(code: String)
  case catalog
  case course(courseId: String, title: String)

  case session
  case sessionSummary(sessionId: String)
  case logbook
  /// `fromCatalog`: started from a public catalog page (its Library page, or "Try a lesson" on a
  /// course or chapter), where main asks its first question.
  case lesson(
    lessonId: String, sessionId: String? = nil, fromCatalog: Bool = false,
    opening: LessonOpening? = nil, activated: Bool = false)
  case questionBlock(sessionId: String, blockId: String)
  case mistakePractice(skillId: String? = nil)
  case pattern(patternId: String)
  /// `resultId` opens a test-out already sent, as it was recorded.
  case testOut(chapterId: String, resultId: String? = nil)
  /// `startsTest` opens on the first question, for a learner who already chose to start.
  case focusTest(goalId: String, startsTest: Bool = false)
  /// A learn course's test of what the learner knows, or a language course's walk through its
  /// topics.
  case placementTest(goalId: String)
  /// A language course's level test and its level test-outs; `testOutFirst` picks the test-out,
  /// as a lesson's "Test out of" offer does.
  case levelTest(goalId: String, testOutFirst: Bool = false)
  case challenge(planItemId: String, sessionId: String? = nil)
  case checkpoint(blockId: String, sessionId: String? = nil)
  case essay(blockId: String)
  case mock(blockId: String, sessionId: String? = nil)
  /// A chapter's map full screen, on the goal that opened it.
  case mindMap(goalId: String, chapterId: String)
  /// The Mind maps page's reader: a goal's tab of maps one per screen, from `start` or this device's
  /// place.
  case mindMapStudy(goalId: String, tab: GoalMindMaps.Tab, start: MindMapPosition? = nil)
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
    case .subject, .chapter, .languageUnit, .mindMaps, .exam, .mockChooser, .mistakes,
      .completedLessons, .speaking, .earlierQuestions, .statistics, .certificates, .certificate,
      .catalog, .course:
      .push
    default:
      .task
    }
  }

  /// The catalog has its own signed-out view, and task screens bring their own gates (main's
  /// `AuthGateScreen`).
  var requirement: Requirement {
    switch self {
    case .subject, .mindMaps, .exam, .mockChooser, .mistakes, .completedLessons, .speaking:
      .goal
    case .chapter, .languageUnit, .earlierQuestions, .statistics, .certificates, .certificate:
      .account
    default:
      .none
    }
  }

  var studyTab: AppTab? {
    AppTab.sidebarPlaces.first { $0.studyRoute == self }
  }

  /// The sidebar row this page is: its own, and Level's for the statistics overview, which opens
  /// with Level beside it.
  var sidebarTab: AppTab? {
    self == .statistics() ? .stats(.level) : studyTab
  }
}
