import Foundation
import WebKit

/// The languages a code activity runs, with main's runtime names, file names and time limits
/// (core's `PROGRAM_TIME_LIMIT_MS`).
enum CodeLanguage: String, Decodable, Sendable {
  case javascript, python

  var runtimeName: String {
    switch self {
    case .javascript: "JavaScript"
    case .python: "Python"
    }
  }

  var defaultFileName: String {
    switch self {
    case .javascript: "main.js"
    case .python: "main.py"
    }
  }

  var timeLimitSeconds: Int {
    switch self {
    case .javascript: 3
    case .python: 5
    }
  }
}

/// How a run ended and what it printed, as main's `ProgramRun`.
struct CodeProgramRun: Equatable, Sendable {
  enum Stop: String, Sendable {
    case done, error, timeout, tooMuchOutput, unavailable
  }

  var stop: Stop
  var output = ""
  /// What the program wrote to stderr, like `console.error` or warnings.
  var errorOutput = ""
  /// The error the run stopped on, and the line of the learner's program it points to.
  var error: String?
  var errorLine: Int?
}

/// Runs a learner's program on the device, never on our servers: a page no one sees hosts main's
/// sandbox (`CodeWorkerSources`). Python keeps one warm worker, so Pyodide loads once per activity;
/// JavaScript gets a new worker per run. Closing the runner, or dropping it, releases the page and
/// everything in it.
@MainActor
final class CodeProgramRunner {
  /// Nothing a page does is saved on the device; sharing one store lets a later activity reuse
  /// what an earlier one cached.
  private static let dataStore = WKWebsiteDataStore.nonPersistent()

  private let language: CodeLanguage
  private var page: Task<WebPage, any Error>?

  init(language: CodeLanguage) {
    self.language = language
  }

  /// Loads the runtime before the first run, so Run doesn't wait for Pyodide. False when it
  /// didn't load, like when offline.
  func warmUp() async -> Bool {
    (try? await call("return await warmUp()")) as? Bool ?? false
  }

  func run(_ code: String) async -> CodeProgramRun {
    guard
      let result = try? await call("return await run(code)", arguments: ["code": code])
        as? [String: Any]
    else {
      return CodeProgramRun(stop: .unavailable)
    }

    return CodeProgramRun(
      stop: (result["stop"] as? String).flatMap(CodeProgramRun.Stop.init) ?? .unavailable,
      output: result["output"] as? String ?? "",
      errorOutput: result["errorOutput"] as? String ?? "",
      error: result["message"] as? String,
      errorLine: result["line"] as? Int)
  }

  func close() {
    page?.cancel()
    page = nil
  }

  private func call(_ body: String, arguments: [String: Any] = [:]) async throws -> Any? {
    do {
      return try await loadedPage().callJavaScript(body, arguments: arguments)
    } catch {
      // A page that didn't load, or whose process ended, starts over on the next call.
      page = nil
      throw error
    }
  }

  private func loadedPage() async throws -> WebPage {
    if let page {
      return try await page.value
    }

    let html = CodeWorkerSources.page(language)
    let loading = Task {
      var configuration = WebPage.Configuration()
      configuration.websiteDataStore = Self.dataStore
      let page = WebPage(configuration: configuration)
      for try await _ in page.load(html: html) {}
      return page
    }
    page = loading
    return try await loading.value
  }
}
