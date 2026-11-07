import Foundation

enum AccountLinks {
  static let appleAccountAuthorizations = URL(string: "https://support.apple.com/102571")!
  static var blog: URL { mainPage("/blog") }
  static var fairUse: URL { mainPage("/terms#fair-use") }
  static var privacy: URL { mainPage("/privacy") }
  static var support: URL { mainPage("/support") }
  static var terms: URL { mainPage("/terms") }

  /// Main picks the language of an address without one from the browser, which follows the device
  /// rather than the app. English pages have no prefix, as main's routing names them.
  private static func mainPage(_ path: String) -> URL {
    let language = currentCourseCatalogLanguage()
    return URL(string: "https://www.zoonk.com\(language == "en" ? "" : "/\(language)")\(path)")!
  }
}

enum StoreSubscriptionProvider: String {
  case apple
  case google
}
