import SwiftUI

@main
struct ZoonkApp: App {
  @State private var buddy: BuddyStore
  @State private var courseCatalog: CourseCatalogStore
  @State private var exam: ExamStore
  @State private var explain: ExplainStore
  @State private var goalContent: GoalContentStore
  @State private var learnerSummary: LearnerSummaryStore
  @State private var mindMaps: MindMapsStore
  @State private var onboarding: OnboardingStore
  @State private var plan: PlanStore
  @State private var practice: PracticeStore
  @State private var progress: ProgressStore
  @State private var session: SessionStore
  @State private var settings: SettingsStore
  @State private var studySession: StudySessionStore
  @State private var subscriptions: AppStoreSubscriptionStore
  @State private var today: TodayStore
  @State private var tutor: TutorStore
  @State private var voice: VoiceServices
  private let cache: AppCache
  private let initialSheet: AppSheet?
  private let lessonPlayer: LessonPlayerDependencies
  private let privateImages: PrivateImageLoader
  #if DEBUG
    private let uiTestFixtureFailure: String?
  #endif

  init() {
    #if DEBUG
      let configuration = UITestConfiguration.current
      let dependencies = configuration?.dependencies ?? .live()
      let initiallyPresentsAccount = configuration?.initiallyPresentsAccount ?? false
      uiTestFixtureFailure = configuration?.fixtureFailure
    #else
      let dependencies = AppDependencies.live()
      let initiallyPresentsAccount = false
    #endif

    _buddy = State(initialValue: dependencies.buddyStore)
    cache = dependencies.cache
    _courseCatalog = State(initialValue: dependencies.courseCatalogStore)
    _exam = State(initialValue: dependencies.examStore)
    _explain = State(initialValue: dependencies.explainStore)
    _goalContent = State(initialValue: dependencies.goalContentStore)
    _learnerSummary = State(initialValue: dependencies.learnerSummaryStore)
    lessonPlayer = dependencies.lessonPlayer
    _mindMaps = State(initialValue: dependencies.mindMapsStore)
    _plan = State(initialValue: dependencies.planStore)
    _onboarding = State(initialValue: dependencies.onboardingStore)
    _practice = State(initialValue: dependencies.practiceStore)
    privateImages = dependencies.privateImageLoader
    _progress = State(initialValue: dependencies.progressStore)
    initialSheet = initiallyPresentsAccount ? .account : nil
    _session = State(initialValue: dependencies.sessionStore)
    _settings = State(initialValue: dependencies.settingsStore)
    _studySession = State(initialValue: dependencies.studySessionStore)
    _subscriptions = State(initialValue: dependencies.subscriptionStore)
    _today = State(initialValue: dependencies.todayStore)
    _tutor = State(initialValue: dependencies.tutorStore)
    _voice = State(initialValue: dependencies.voice)
  }

  var body: some Scene {
    WindowGroup {
      AppWindow(initialSheet: initialSheet, today: today, sessions: studySession)
        #if DEBUG
          .modifier(UITestFixtureFailureCover(failure: uiTestFixtureFailure))
        #endif
        .loads(learnerSummary.summary, refreshable: false)
        .task(id: learnerSummary.summary.value?.nextChangeAt) {
          await learnerSummary.refreshAtNextChange()
        }
        .onChange(of: session.authenticatedSession) {
          cache.followSession()
        }
        .environment(buddy)
        .environment(courseCatalog)
        .environment(exam)
        .environment(explain)
        .environment(goalContent)
        .environment(learnerSummary)
        .environment(mindMaps)
        .environment(plan)
        .environment(onboarding)
        .environment(practice)
        .environment(progress)
        .environment(session)
        .environment(settings)
        .environment(studySession)
        .environment(subscriptions)
        .environment(today)
        .environment(tutor)
        .environment(voice)
        .environment(\.privateImageLoader, privateImages)
        .environment(\.lessonTutor, .buddy)
        .environment(\.lessonPlayer, lessonPlayer)
        .environment(\.lessonAudio, .voice(voice))
        .environment(\.spokenAnswerRecording, .voice)
        .environment(\.activityRenderers, .app)
    }
  }
}

private struct AppWindow: View {
  @Environment(SessionStore.self) private var session
  @State private var router: AppRouter

  init(initialSheet: AppSheet?, today: TodayStore, sessions: StudySessionStore) {
    _router = State(
      initialValue: AppRouter(
        sheet: initialSheet,
        openBlock: AppRouter.openingTodayBlocks(today: today, sessions: sessions)))
  }

  var body: some View {
    AppView()
      #if DEBUG
        .modifier(DebugLessonLaunch())
        // Inside the app's environment, so the gallery's screens get the app's renderers.
        .modifier(ActivityGalleryLaunch())
        .modifier(DebugCharacterGallery())
      #endif
      // Made from the router the window keeps: `init` runs again on every update of the app.
      .environment(router)
      .environment(\.lessonPlayerRoutes, .routed(by: router))
      .environment(\.practiceHooks, .routed(by: router))
      .environment(\.tutorPlaces, .routed(by: router))
      .onOpenURL { url in
        if !router.open(url: url) {
          session.handleGoogleSignInURL(url)
        }
      }
  }
}
