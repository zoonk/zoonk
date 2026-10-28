@MainActor
struct AppDependencies {
  let buddyStore: BuddyStore
  let cache: AppCache
  let courseCatalogStore: CourseCatalogStore
  let examStore: ExamStore
  let explainStore: ExplainStore
  let goalContentStore: GoalContentStore
  let learnerSummaryStore: LearnerSummaryStore
  let lessonPlayer: LessonPlayerDependencies
  let mindMapsStore: MindMapsStore
  let onboardingStore: OnboardingStore
  let planStore: PlanStore
  let practiceStore: PracticeStore
  let privateImageLoader: PrivateImageLoader
  let progressStore: ProgressStore
  let sessionStore: SessionStore
  let settingsStore: SettingsStore
  let studySessionStore: StudySessionStore
  let subscriptionStore: AppStoreSubscriptionStore
  let todayStore: TodayStore
  let tutorStore: TutorStore
  let voice: VoiceServices

  static func live(
    configuration: AppConfiguration = .current, mindMapsAPI: (any MindMapsAPIClient)? = nil
  ) -> AppDependencies {
    let clients = APIClientFactory.live(baseURL: configuration.apiBaseURL)
    let sessionStore = SessionStore(
      api: AccountAPI(clients: clients),
      credentialStore: SessionCredentialStore(),
      googleAuthentication: GoogleAuthenticationClient())

    return AppDependencies(
      clients: clients,
      session: sessionStore,
      privateImageLoader: .live(configuration: configuration),
      subscriptionStore: .live(),
      mindMapsAPI: mindMapsAPI)
  }

  /// Builds every data store on one cache, so mutations and session changes reach all of them.
  init(
    clients: APIClientFactory,
    session: SessionStore,
    privateImageLoader: PrivateImageLoader,
    subscriptionStore: AppStoreSubscriptionStore,
    buddyAPI: (any BuddyAPIClient)? = nil,
    courseCatalogAPI: (any CourseCatalogAPIClient)? = nil,
    learnerSummaryAPI: (any LearnerSummaryAPIClient)? = nil,
    mindMapsAPI: (any MindMapsAPIClient)? = nil,
    progressAPI: (any ProgressAPIClient)? = nil,
    settingsAPI: (any SettingsAPIClient)? = nil,
    studyAPI: (any StudyAPIClient)? = nil,
    tutorAPI: (any TutorAPIClient)? = nil
  ) {
    let cache = AppCache(session: session)
    self.cache = cache
    buddyStore = BuddyStore(api: buddyAPI ?? BuddyAPI(clients: clients), cache: cache)
    courseCatalogStore = CourseCatalogStore(
      api: courseCatalogAPI ?? CourseCatalogAPI(clients: clients),
      language: currentCourseCatalogLanguage(),
      cache: cache)
    examStore = ExamStore(api: ExamAPI(clients: clients), cache: cache)
    explainStore = ExplainStore(clients: clients, cache: cache)
    learnerSummaryStore = LearnerSummaryStore(
      api: learnerSummaryAPI ?? LearnerSummaryAPI(clients: clients),
      cache: cache)
    let settingsStore = SettingsStore(
      api: settingsAPI ?? SettingsAPI(clients: clients), cache: cache)
    self.settingsStore = settingsStore
    lessonPlayer = LessonPlayerDependencies(
      api: LessonPlayerAPI(clients: clients), cache: cache,
      preferences: settingsStore.preferences)
    goalContentStore = GoalContentStore(api: GoalContentAPI(clients: clients), cache: cache)
    mindMapsStore = MindMapsStore(
      api: mindMapsAPI ?? MindMapsAPI(clients: clients), cache: cache)
    onboardingStore = OnboardingStore(clients: clients, cache: cache, session: session)
    planStore = PlanStore(api: PlanAPI(clients: clients), cache: cache)
    practiceStore = PracticeStore(api: PracticeAPI(clients: clients), cache: cache)
    self.privateImageLoader = privateImageLoader
    progressStore = ProgressStore(
      api: progressAPI ?? ProgressAPI(clients: clients),
      cache: cache)
    sessionStore = session
    let studyAPI = studyAPI ?? StudyAPI(clients: clients)
    studySessionStore = StudySessionStore(api: studyAPI, cache: cache)
    todayStore = TodayStore(api: studyAPI, cache: cache)
    self.subscriptionStore = subscriptionStore
    tutorStore = TutorStore(api: tutorAPI ?? TutorAPI(clients: clients), cache: cache)
    voice = VoiceServices(clients: clients, cache: cache)
  }
}
