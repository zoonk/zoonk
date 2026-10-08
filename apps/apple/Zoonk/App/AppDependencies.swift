@MainActor
struct AppDependencies {
  let courseCatalogStore: CourseCatalogStore
  let myCoursesStore: MyCoursesStore
  let plusAccessStore: PlusAccessStore
  let privateImageLoader: PrivateImageLoader
  let progressStore: ProgressStore
  let sessionStore: SessionStore
  let subscriptionStore: AppStoreSubscriptionStore

  static func live(configuration: AppConfiguration = .current) -> AppDependencies {
    let clients = APIClientFactory.live(baseURL: configuration.apiBaseURL)
    let accountAPI = AccountAPI(clients: clients)
    let sessionStore = SessionStore(
      api: accountAPI,
      credentialStore: SessionCredentialStore(),
      googleAuthentication: GoogleAuthenticationClient())

    return AppDependencies(
      courseCatalogStore: CourseCatalogStore(
        api: CourseCatalogAPI(clients: clients),
        language: currentCourseCatalogLanguage(),
        session: sessionStore),
      myCoursesStore: MyCoursesStore(
        api: MyCoursesAPI(clients: clients),
        session: sessionStore),
      plusAccessStore: PlusAccessStore(
        api: PlusAccessAPI(clients: clients),
        session: sessionStore),
      privateImageLoader: .live(configuration: configuration),
      progressStore: ProgressStore(
        api: ProgressAPI(clients: clients),
        session: sessionStore),
      sessionStore: sessionStore,
      subscriptionStore: .live())
  }
}
