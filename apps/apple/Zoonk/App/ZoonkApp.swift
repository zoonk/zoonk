import SwiftUI

@main
struct ZoonkApp: App {
  @State private var courseCatalog: CourseCatalogStore
  @State private var learnerSummary: LearnerSummaryStore
  @State private var myCourses: MyCoursesStore
  @State private var plan: PlanStore
  @State private var practice: PracticeStore
  @State private var progress: ProgressStore
  @State private var router: AppRouter
  @State private var session: SessionStore
  @State private var settings: SettingsStore
  @State private var subscriptions: AppStoreSubscriptionStore
  private let cache: AppCache
  private let lessonPlayerAPI: LessonPlayerAPI
  private let lessonPlayerRoutes: LessonPlayerRoutes
  private let practiceHooks: PracticeHooks
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

    cache = dependencies.cache
    _courseCatalog = State(initialValue: dependencies.courseCatalogStore)
    _learnerSummary = State(initialValue: dependencies.learnerSummaryStore)
    lessonPlayerAPI = dependencies.lessonPlayerAPI
    _myCourses = State(initialValue: dependencies.myCoursesStore)
    _plan = State(initialValue: dependencies.planStore)
    _practice = State(initialValue: dependencies.practiceStore)
    privateImages = dependencies.privateImageLoader
    _progress = State(initialValue: dependencies.progressStore)
    let router = AppRouter(sheet: initiallyPresentsAccount ? .account : nil)
    _router = State(initialValue: router)
    lessonPlayerRoutes = .routed(by: router)
    practiceHooks = .routed(by: router)
    _session = State(initialValue: dependencies.sessionStore)
    _settings = State(initialValue: dependencies.settingsStore)
    _subscriptions = State(initialValue: dependencies.subscriptionStore)
  }

  var body: some Scene {
    WindowGroup {
      AppView()
        .loads(learnerSummary.summary, refreshable: false)
        .task(id: learnerSummary.summary.value?.nextChangeAt) {
          await learnerSummary.refreshAtNextChange()
        }
        .onChange(of: session.authenticatedSession) {
          cache.followSession()
        }
        .environment(courseCatalog)
        .environment(learnerSummary)
        .environment(myCourses)
        .environment(plan)
        .environment(practice)
        .environment(progress)
        .environment(router)
        .environment(\.lessonPlayerRoutes, lessonPlayerRoutes)
        .environment(\.practiceHooks, practiceHooks)
        .environment(session)
        .environment(settings)
        .environment(subscriptions)
        .environment(\.privateImageLoader, privateImages)
        .environment(\.lessonPlayerAPI, lessonPlayerAPI)
        .environment(\.lessonCompletionHook, .invalidating(cache))
        .onOpenURL { url in
          if !router.open(url: url) {
            session.handleGoogleSignInURL(url)
          }
        }
    }
  }
}
