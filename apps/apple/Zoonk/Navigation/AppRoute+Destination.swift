import SwiftUI

extension AppRoute {
  /// The screen each route shows, behind the shell's gate for what the route requires.
  @MainActor
  var destination: some View {
    ShellGate(requirement: requirement, title: gateTitle) {
      screen
    }
  }

  /// The title over a gate, which stands where the screen's own title would be.
  private var gateTitle: LocalizedStringResource {
    switch self {
    case .mockChooser:
      AppTab.exam.title
    case .earlierQuestions:
      AppTab.buddy.title
    default:
      studyTab?.title ?? AppTab.plan.title
    }
  }

  @MainActor
  @ViewBuilder
  private var screen: some View {
    switch self {
    case .subject(let subjectKey):
      SubjectScreen(subjectKey: subjectKey)
    case .chapter(let chapterId):
      ChapterScreen(chapterId: chapterId)
    case .languageUnit(let chapterId):
      LanguageUnitScreen(chapterId: chapterId)
    case .mindMaps:
      MindMapsScreen()
    case .exam:
      ExamScreen()
    case .mockChooser:
      MockChooserScreen()
    case .mistakes:
      MistakesScreen()
    case .speaking:
      SpeakingScreen()
    case .earlierQuestions:
      EarlierQuestionsScreen()
    case .statistics:
      StatisticsScreen()
    case .catalog:
      CatalogScreen()
    case .course(let courseId, let title):
      CourseView(course: CourseReference(id: courseId, title: title))
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .catalogDestinations()
    case .session:
      SessionScreen()
    case .logbook:
      LogbookScreen()
    case .lesson(let lessonId, let sessionId):
      LessonPlayerScreen(lessonId: lessonId, sessionId: sessionId)
    case .questionBlock(let sessionId, let blockId):
      QuestionBlockScreen(sessionId: sessionId, blockId: blockId)
    case .mistakePractice(let skillId):
      MistakePracticeScreen(skillId: skillId)
    case .pattern(let patternId):
      PatternScreen(patternId: patternId)
    case .testOut(let chapterId):
      TestOutScreen(chapterId: chapterId)
    case .focusTest(let goalId):
      FocusTestScreen(goalId: goalId)
    case .challenge(let planItemId, let sessionId):
      ChallengeScreen(planItemId: planItemId, sessionId: sessionId)
    case .checkpoint(let blockId, let sessionId):
      CheckpointScreen(blockId: blockId, sessionId: sessionId)
    case .essay(let blockId):
      EssayScreen(blockId: blockId)
    case .mock(let blockId, let sessionId):
      MockScreen(blockId: blockId, sessionId: sessionId)
    case .placementMock(let goalId):
      PlacementMockScreen(goalId: goalId)
    case .mindMap(let chapterId):
      MindMapScreen(chapterId: chapterId)
    case .pronunciation(let goalId):
      PronunciationScreen(goalId: goalId)
    case .conversation(let conversationId):
      ConversationScreen(conversationId: conversationId)
    case .startGoal(let goal):
      GoalStartScreen(goal: goal)
    case .goalSetup(let goalId):
      GoalSetupScreen(goalId: goalId)
    case .courseStart(let courseId, let chapterId):
      CourseStartScreen(courseId: courseId, chapterId: chapterId)
    case .explain(let goalId):
      ExplainScreen(goalId: goalId)
    case .planLink(let planId):
      PlanLinkScreen(planId: planId)
    }
  }
}

extension AppTab {
  /// The tab's root screen; a Study place's is the same screen its push shows.
  @MainActor
  @ViewBuilder
  var root: some View {
    switch self {
    case .today:
      TodayScreen()
    case .plan:
      ShellGate(requirement: .goal, title: title) {
        PlanScreen()
      }
    case .buddy:
      ShellGate(requirement: .account, title: title) {
        BuddyScreen()
      }
    case .search:
      SearchScreen()
    case .mistakes, .exam, .speaking, .mindMaps, .statistics:
      studyRoute?.destination
    }
  }
}

/// A full-screen task, which can cover itself with the next one (a session opening a lesson).
struct PresentedTask: View {
  @Environment(AppRouter.self) private var router

  let route: AppRoute
  let depth: Int

  var body: some View {
    route.destination
      .environment(\.isCoveredByTask, router.tasks.count > depth + 1)
      .fullScreenCover(item: router.task(at: depth + 1)) { next in
        PresentedTask(route: next, depth: depth + 1)
      }
      .sheet(item: router.sheet(presentedBy: depth + 1)) { sheet in
        AppSheetView(sheet: sheet)
      }
  }
}
