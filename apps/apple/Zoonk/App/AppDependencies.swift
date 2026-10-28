@MainActor
struct AppDependencies {
  let cache: AppCache
  let courseCatalogStore: CourseCatalogStore
  let goalContentStore: GoalContentStore
  let learnerSummaryStore: LearnerSummaryStore
  let lessonPlayerAPI: LessonPlayerAPI
  let mindMapsStore: MindMapsStore
  let myCoursesStore: MyCoursesStore
  let planStore: PlanStore
  let practiceStore: PracticeStore
  let privateImageLoader: PrivateImageLoader
  let progressStore: ProgressStore
  let sessionStore: SessionStore
  let settingsStore: SettingsStore
  let subscriptionStore: AppStoreSubscriptionStore
  let tutorStore: TutorStore

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
    progressAPI: (any ProgressAPIClient)? = nil,
    settingsAPI: (any SettingsAPIClient)? = nil,
    tutorAPI: (any TutorAPIClient)? = nil
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
    goalContentStore = GoalContentStore(api: GoalContentAPI(clients: clients), cache: cache)
    mindMapsStore = MindMapsStore(api: MindMapsAPI(clients: clients), cache: cache)
    planStore = PlanStore(api: PlanAPI(clients: clients), cache: cache)
    practiceStore = PracticeStore(api: PracticeAPI(clients: clients), cache: cache)
    self.privateImageLoader = privateImageLoader
    progressStore = ProgressStore(
      api: progressAPI ?? ProgressAPI(clients: clients),
      cache: cache)
    sessionStore = session
    settingsStore = SettingsStore(api: settingsAPI ?? SettingsAPI(clients: clients), cache: cache)
    self.subscriptionStore = subscriptionStore
    tutorStore = TutorStore(api: tutorAPI ?? TutorAPI(clients: clients), cache: cache)
  }
}
