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
  @State private var router: AppRouter
  @State private var session: SessionStore
  @State private var settings: SettingsStore
  @State private var studySession: StudySessionStore
  @State private var subscriptions: AppStoreSubscriptionStore
  @State private var today: TodayStore
  @State private var tutor: TutorStore
  @State private var voice: VoiceServices
  private let cache: AppCache
  private let lessonPlayer: LessonPlayerDependencies
  private let lessonPlayerRoutes: LessonPlayerRoutes
  private let practiceHooks: PracticeHooks
  private let tutorPlaces: TutorPlaces
  private let privateImages: PrivateImageLoader

  init() {
    #if DEBUG
      let configuration = UITestConfiguration.current
      let dependencies = configuration?.dependencies ?? .live()
      let initiallyPresentsAccount = configuration?.initiallyPresentsAccount ?? false
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
    let router = AppRouter(
      sheet: initiallyPresentsAccount ? .account : nil,
      openBlock: AppRouter.openingTodayBlocks(
        today: dependencies.todayStore, sessions: dependencies.studySessionStore))
    _router = State(initialValue: router)
    lessonPlayerRoutes = .routed(by: router)
    practiceHooks = .routed(by: router)
    tutorPlaces = .routed(by: router)
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
      AppView()
        #if DEBUG
          .modifier(DebugLessonLaunch())
          // Inside the environment below, so the gallery's screens get the app's renderers.
          .modifier(ActivityGalleryLaunch())
          .modifier(DebugCharacterGallery())
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
        .environment(router)
        .environment(\.lessonPlayerRoutes, lessonPlayerRoutes)
        .environment(\.practiceHooks, practiceHooks)
        .environment(session)
        .environment(settings)
        .environment(studySession)
        .environment(subscriptions)
        .environment(today)
        .environment(tutor)
        .environment(voice)
        .environment(\.privateImageLoader, privateImages)
        .environment(\.lessonTutor, .buddy)
        .environment(\.tutorPlaces, tutorPlaces)
        .environment(\.lessonPlayer, lessonPlayer)
        .environment(\.lessonAudio, .voice(voice))
        .environment(\.spokenAnswerRecording, .voice)
        .environment(\.activityRenderers, .app)
        .onOpenURL { url in
          if !router.open(url: url) {
            session.handleGoogleSignInURL(url)
          }
        }
    }
  }
}
