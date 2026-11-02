import Foundation
import Sentry

enum ErrorReporting {
  /// Only the Release Info.plist names a DSN, so Debug builds never report.
  static func start() {
    guard let dsn = Bundle.main.object(forInfoDictionaryKey: "ZoonkSentryDSN") as? String else {
      return
    }

    SentrySDK.start { options in
      options.dsn = dsn
      options.tracesSampleRate = 0.1
      options.tracePropagationTargets = [apiRequests()]
      // The API reports its own failures, and file paths can name a learner's attachment.
      options.enableCaptureFailedRequests = false
      options.enableFileIOTracing = false
      // Query strings carry upload credentials and what learners search for.
      options.beforeBreadcrumb = { breadcrumb in
        breadcrumb.setData(value: nil, key: "http.query")
        breadcrumb.setData(value: nil, key: "http.fragment")
        return breadcrumb
      }
      options.beforeSendSpan = { span in
        span.removeData(key: "http.query")
        span.removeData(key: "http.fragment")
        return span
      }
    }
  }

  private static func apiRequests() -> NSRegularExpression {
    let api = NSRegularExpression.escapedPattern(
      for: AppConfiguration.current.apiBaseURL.absoluteString)
    return try! NSRegularExpression(pattern: "^\(api)/")
  }
}
