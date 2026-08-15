@MainActor
struct AppDependencies {
  let sessionStore: SessionStore

  static func live(configuration: AppConfiguration = .current) -> AppDependencies {
    let clients = APIClientFactory.live(baseURL: configuration.apiBaseURL)
    let accountAPI = AccountAPI(clients: clients)

    return AppDependencies(
      sessionStore: SessionStore(
        api: accountAPI,
        credentialStore: SessionCredentialStore(),
        googleAuthentication: GoogleAuthenticationClient()))
  }
}
