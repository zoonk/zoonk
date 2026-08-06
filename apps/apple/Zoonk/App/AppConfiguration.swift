import Foundation

struct AppConfiguration {
  let apiBaseURL: URL

  static let current = AppConfiguration(apiBaseURL: configuredAPIBaseURL())

  /// Resolves the API origin once at the application boundary. Debug launches can override the bundled localhost default with an Xcode scheme environment value, while signed release builds always use the value embedded by their build configuration.
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

  /// Rejects relative or non-HTTP values before they can silently produce requests against an unintended origin. Debug builds may receive this value from an Xcode scheme so developers can point a simulator at any local API port; release builds receive the production value from the signed bundle.
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
