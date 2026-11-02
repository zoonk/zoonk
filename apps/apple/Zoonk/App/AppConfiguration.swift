import Foundation

struct AppConfiguration {
  let apiBaseURL: URL

  static let current = AppConfiguration(apiBaseURL: configuredAPIBaseURL())

  private static func configuredAPIBaseURL() -> URL {
    #if DEBUG
      if let override = ProcessInfo.processInfo.environment["ZOONK_API_BASE_URL"] {
        return validatedAPIBaseURL(override)
      }
    #endif

    guard let configuredURL = Bundle.main.object(forInfoDictionaryKey: "ZoonkAPIBaseURL") as? String
    else {
      preconditionFailure("ZoonkAPIBaseURL is missing from the app configuration")
    }

    return validatedAPIBaseURL(configuredURL)
  }

  private static func validatedAPIBaseURL(_ value: String) -> URL {
    guard
      let url = URL(string: value),
      let scheme = url.scheme,
      ["http", "https"].contains(scheme),
      url.host != nil
    else {
      preconditionFailure("Invalid Zoonk API base URL: \(value)")
    }

    return url
  }
}
