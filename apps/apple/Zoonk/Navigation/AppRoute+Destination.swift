import SwiftUI

extension AppRoute {
  @MainActor
  var destination: some View {
    ShellGate(requirement: requirement, title: gateTitle, description: gateDescription) {
      screen
    }
  }

  private var gateTitle: LocalizedStringResource {
    switch self {
    case .chapter:
      LocalizedStringResource(
        "Chapter", table: "Navigation",
        comment: "Title shown instead of a chapter of the plan until it can open")
    case .languageUnit:
      LocalizedStringResource(
        "Unit", table: "Navigation",
        comment: "Title shown instead of a unit of a language plan until it can open")
    case .exam:
      LocalizedStringResource("Your exam", table: "Exam", comment: "Exam page title")
    case .mockChooser:
      LocalizedStringResource("Take a mock exam", table: "Mock", comment: "Mock chooser title")
    case .speaking:
      LocalizedStringResource(
        "Speaking practice", table: "Voice", comment: "Speaking practice page title")
    case .earlierQuestions:
      AppTab.buddy.title
    default:
      studyTab?.title ?? AppTab.plan.title
    }
  }

  private var gateDescription: LocalizedStringResource? {
    switch self {
    case .subject:
      Self.planDescription
    case .chapter:
      LocalizedStringResource(
        "A chapter of your plan, with its lessons and how far you are.", table: "Navigation",
        comment: "What a chapter page shows, under its title until it can open")
    case .languageUnit:
      LocalizedStringResource(
        "A unit of your language plan, with its lessons and how far you are.",
        table: "Navigation",
        comment: "What a language unit page shows, under its title until it can open")
    case .mindMaps:
      LocalizedStringResource(
        "Each chapter's ideas on one map, to review how they connect.", table: "Navigation",
        comment: "What the mind maps page shows, under its title until it can open")
    case .exam:
      LocalizedStringResource(
        "Your exam's areas, how ready you are for each, and its mock exams.", table: "Exam",
        comment: "What the exam page shows, for a goal that isn't an exam")
    case .mockChooser:
      LocalizedStringResource(
        "Mock exam, timed like the real one", table: "Mock", comment: "What mocks are")
    case .mistakes:
      LocalizedStringResource(
        "The questions you got wrong, why, and practice until you get them right.",
        table: "Navigation",
        comment: "What the mistakes notebook shows, under its title until it can open")
    case .speaking:
      LocalizedStringResource(
        "Calls in the language you're learning, at your level.", table: "Voice",
        comment: "What speaking practice is, without a goal")
    default:
      nil
    }
  }

  fileprivate static let planDescription = LocalizedStringResource(
    "What you'll study each day until your goal, and what it covers.", table: "Navigation",
    comment: "What the plan shows, under its title until it can open")

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
    case .startGoal(let goal, let draftId):
      GoalStartScreen(goal: goal, draftID: draftId)
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
  @MainActor
  @ViewBuilder
  var root: some View {
    switch self {
    case .today:
      TodayScreen()
    case .plan:
      ShellGate(
        requirement: .goal, title: title, description: AppRoute.planDescription,
        startsGoalHere: true
      ) {
        PlanScreen()
      }
    case .buddy:
      ShellGate(
        requirement: .account, title: title,
        description: LocalizedStringResource(
          "Your buddy answers your questions and adjusts your plan.", table: "Navigation",
          comment: "What the buddy is for, under its title until someone logs in")
      ) {
        BuddyScreen()
      }
    case .search:
      SearchScreen()
    case .mistakes, .exam, .speaking, .mindMaps, .statistics:
      studyRoute?.destination
    }
  }
}

struct PresentedTask: View {
  @Environment(AppRouter.self) private var router

  let route: AppRoute
  let depth: Int

  var body: some View {
    let isHidden = router.isHidden(taskAt: depth)

    route.destination
      .opacity(isHidden ? 0 : 1)
      .accessibilityHidden(isHidden)
      .presentationBackground(isHidden ? AnyShapeStyle(.clear) : AnyShapeStyle(.background))
      .environment(\.isCoveredByTask, router.tasks.count > depth + 1)
      .fullScreenCover(item: router.task(at: depth + 1)) { next in
        PresentedTask(route: next, depth: depth + 1)
      }
      .sheet(item: router.sheet(presentedBy: depth + 1)) { sheet in
        AppSheetView(sheet: sheet)
      }
  }
}
