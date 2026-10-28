import SwiftUI

@main
struct ZoonkApp: App {
  @State private var courseCatalog: CourseCatalogStore
  @State private var learnerSummary: LearnerSummaryStore
  @State private var myCourses: MyCoursesStore
  @State private var progress: ProgressStore
  @State private var session: SessionStore
  @State private var subscriptions: AppStoreSubscriptionStore
  private let cache: AppCache
  private let initiallyPresentsAccount: Bool
  private let privateImages: PrivateImageLoader

  init() {
    #if DEBUG
      let configuration = UITestConfiguration.current
      let dependencies = configuration?.dependencies ?? .live()
      initiallyPresentsAccount = configuration?.initiallyPresentsAccount ?? false
    #else
      let dependencies = AppDependencies.live()
      initiallyPresentsAccount = false
    #endif

    cache = dependencies.cache
    _courseCatalog = State(initialValue: dependencies.courseCatalogStore)
    _learnerSummary = State(initialValue: dependencies.learnerSummaryStore)
    _myCourses = State(initialValue: dependencies.myCoursesStore)
    privateImages = dependencies.privateImageLoader
    _progress = State(initialValue: dependencies.progressStore)
    _session = State(initialValue: dependencies.sessionStore)
    _subscriptions = State(initialValue: dependencies.subscriptionStore)
  }

  var body: some Scene {
    WindowGroup {
      AppView(initiallyPresentsAccount: initiallyPresentsAccount)
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
        .environment(progress)
        .environment(session)
        .environment(subscriptions)
        .environment(\.privateImageLoader, privateImages)
        .onOpenURL { url in
          session.handleGoogleSignInURL(url)
        }
    }
  }
}
