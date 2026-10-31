@MainActor
struct AppDependencies {
  let birthYearGate: BirthYearGate
  let buddyStore: BuddyStore
  let cache: AppCache
  let courseCatalogStore: CourseCatalogStore
  let examStore: ExamStore
  let explainStore: ExplainStore
  let goalContentStore: GoalContentStore
  let imageLoader: ImageLoader
  let learnerSummaryStore: LearnerSummaryStore
  let lessonPlayer: LessonPlayerDependencies
  let mindMapsStore: MindMapsStore
  let onboardingStore: OnboardingStore
  let planStore: PlanStore
  let practiceStore: PracticeStore
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
      imageLoader: .live(configuration: configuration),
      subscriptionStore: .live(),
      mindMapsAPI: mindMapsAPI)
  }

  init(
    clients: APIClientFactory,
    session: SessionStore,
    imageLoader: ImageLoader,
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
    let learnerSummaryStore = LearnerSummaryStore(
      api: learnerSummaryAPI ?? LearnerSummaryAPI(clients: clients),
      cache: cache)
    self.learnerSummaryStore = learnerSummaryStore
    let birthYearGate = BirthYearGate(
      api: BirthYearAPI(clients: clients), cache: cache, summary: learnerSummaryStore.summary)
    self.birthYearGate = birthYearGate
    let settingsStore = SettingsStore(
      api: settingsAPI ?? SettingsAPI(clients: clients), cache: cache)
    self.settingsStore = settingsStore
    let studyAPI = studyAPI ?? StudyAPI(clients: clients)
    let todayStore = TodayStore(api: studyAPI, cache: cache)
    self.todayStore = todayStore
    let studySessionStore = StudySessionStore(api: studyAPI, cache: cache, today: todayStore)
    self.studySessionStore = studySessionStore
    lessonPlayer = LessonPlayerDependencies(
      api: LessonPlayerAPI(clients: clients), cache: cache,
      preferences: settingsStore.preferences,
      blockFinished: { studySessionStore.apply($1, sessionID: $0) })
    goalContentStore = GoalContentStore(api: GoalContentAPI(clients: clients), cache: cache)
    self.imageLoader = imageLoader
    mindMapsStore = MindMapsStore(
      api: mindMapsAPI ?? MindMapsAPI(clients: clients), cache: cache)
    onboardingStore = OnboardingStore(
      clients: clients, cache: cache, session: session, birthYear: birthYearGate)
    planStore = PlanStore(api: PlanAPI(clients: clients), cache: cache)
    practiceStore = PracticeStore(api: PracticeAPI(clients: clients), cache: cache)
    progressStore = ProgressStore(
      api: progressAPI ?? ProgressAPI(clients: clients),
      cache: cache)
    sessionStore = session
    self.subscriptionStore = subscriptionStore
    tutorStore = TutorStore(api: tutorAPI ?? TutorAPI(clients: clients), cache: cache)
    voice = VoiceServices(clients: clients, cache: cache)
  }
}
