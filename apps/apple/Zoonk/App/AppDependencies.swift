@MainActor
struct AppDependencies {
  let cache: AppCache
  let courseCatalogStore: CourseCatalogStore
  let learnerSummaryStore: LearnerSummaryStore
  let lessonPlayerAPI: LessonPlayerAPI
  let myCoursesStore: MyCoursesStore
  let practiceStore: PracticeStore
  let privateImageLoader: PrivateImageLoader
  let progressStore: ProgressStore
  let sessionStore: SessionStore
  let subscriptionStore: AppStoreSubscriptionStore

  static func live(configuration: AppConfiguration = .current) -> AppDependencies {
    let clients = APIClientFactory.live(baseURL: configuration.apiBaseURL)
    let sessionStore = SessionStore(
      api: AccountAPI(clients: clients),
      credentialStore: SessionCredentialStore(),
      googleAuthentication: GoogleAuthenticationClient())

    return AppDependencies(
      clients: clients,
      session: sessionStore,
      privateImageLoader: .live(configuration: configuration),
      subscriptionStore: .live())
  }

  /// Builds every data store on one cache, so mutations and session changes reach all of them.
  init(
    clients: APIClientFactory,
    session: SessionStore,
    privateImageLoader: PrivateImageLoader,
    subscriptionStore: AppStoreSubscriptionStore,
    courseCatalogAPI: (any CourseCatalogAPIClient)? = nil,
    learnerSummaryAPI: (any LearnerSummaryAPIClient)? = nil,
    myCoursesAPI: (any MyCoursesAPIClient)? = nil,
    progressAPI: (any ProgressAPIClient)? = nil
  ) {
    let cache = AppCache(session: session)
    self.cache = cache
    courseCatalogStore = CourseCatalogStore(
      api: courseCatalogAPI ?? CourseCatalogAPI(clients: clients),
      language: currentCourseCatalogLanguage(),
      cache: cache)
    learnerSummaryStore = LearnerSummaryStore(
      api: learnerSummaryAPI ?? LearnerSummaryAPI(clients: clients),
      cache: cache)
    lessonPlayerAPI = LessonPlayerAPI(clients: clients)
    myCoursesStore = MyCoursesStore(
      api: myCoursesAPI ?? MyCoursesAPI(clients: clients),
      session: session)
    practiceStore = PracticeStore(api: PracticeAPI(clients: clients), cache: cache)
    self.privateImageLoader = privateImageLoader
    progressStore = ProgressStore(
      api: progressAPI ?? ProgressAPI(clients: clients),
      cache: cache)
    sessionStore = session
    self.subscriptionStore = subscriptionStore
  }
}
