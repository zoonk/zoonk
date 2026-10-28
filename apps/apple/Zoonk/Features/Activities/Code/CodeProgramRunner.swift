import Foundation
import WebKit

struct CodeProgramResult: Equatable, Sendable {
  enum Stop: Sendable { case done, error, timeout, tooMuchOutput, unavailable, cancelled }
  var output = ""
  var errorOutput = ""
  var message: String?
  var stop: Stop = .done
}

/// A fresh nonpersistent page and worker per run. No app session or host objects enter it.
@MainActor
final class CodeProgramRunner: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
  private var webView: WKWebView?
  private var continuation: CheckedContinuation<CodeProgramResult, Never>?
  private var deadline: Task<Void, Never>?
  private var result = CodeProgramResult()
  private var code = ""
  private var language = ""
  private var runID = UUID()

  func run(code: String, language: String) async -> CodeProgramResult {
    cancel()
    let id = UUID()
    runID = id
    self.code = code
    self.language = language
    result = CodeProgramResult()
    return await withTaskCancellationHandler {
      await withCheckedContinuation { continuation in
        self.continuation = continuation
        if Task.isCancelled {
          finish(.cancelled)
          return
        }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(self, name: "runner")
        let page = WKWebView(frame: .zero, configuration: configuration)
        page.navigationDelegate = self
        webView = page
        let source = language == "python" ? CodeWorkerSources.python : CodeWorkerSources.javascript
        let encoded = String(data: try! JSONEncoder().encode(source), encoding: .utf8)!
        // Blob workers inherit CSP. Runtime downloads are restricted to the pinned Pyodide path;
        // worker globals are locked after initialization, before learner code receives control.
        let runtime = language == "python" ? "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/" : ""
        page.loadHTMLString(
          """
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: \(runtime); worker-src blob:; connect-src \(runtime.isEmpty ? "'none'" : runtime);">
          <script>
          const worker = new Worker(URL.createObjectURL(new Blob([\(encoded)], {type:'text/javascript'})), {type:'module'});
          worker.onmessage = e => window.webkit.messageHandlers.runner.postMessage(e.data);
          worker.onerror = e => window.webkit.messageHandlers.runner.postMessage({type:'loadError',message:e.message});
          function stopWorker() { worker.terminate(); }
          function runCode(code) { worker.postMessage({id:1,code}); }
          </script>
          """, baseURL: nil)
        armDeadline(seconds: 60, stop: .unavailable)
      }
    } onCancel: {
      Task { @MainActor [weak self] in if self?.runID == id { self?.cancel() } }
    }
  }

  func cancel() { finish(.cancelled) }

  func userContentController(
    _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
  ) {
    guard message.webView === webView, continuation != nil else { return }
    guard let body = message.body as? [String: Any], let type = body["type"] as? String else {
      return
    }
    if type == "ready" {
      armDeadline(seconds: language == "python" ? 5 : 3, stop: .timeout)
      webView?.callAsyncJavaScript(
        "runCode(code)", arguments: ["code": code], in: nil, in: .page, completionHandler: nil)
    } else if let event = Self.parseMessage(body) {
      switch event {
      case .output(let stream, let text):
        let remaining = max(0, 10_000 - result.output.utf16.count - result.errorOutput.utf16.count)
        if stream == "stderr" {
          result.errorOutput += String(decoding: text.utf16.prefix(remaining), as: UTF16.self)
        } else {
          result.output += String(decoding: text.utf16.prefix(remaining), as: UTF16.self)
        }
        if text.utf16.count > remaining { finish(.tooMuchOutput) }
      case .end(let stop, let message):
        result.message = message
        finish(stop)
      }
    }
  }

  enum Event: Equatable {
    case output(String, String)
    case end(CodeProgramResult.Stop, String?)
  }

  nonisolated static func parseMessage(_ body: [String: Any]) -> Event? {
    switch body["type"] as? String {
    case "output":
      guard let stream = body["stream"] as? String, ["stdout", "stderr"].contains(stream),
        let text = body["text"] as? String
      else { return nil }
      return .output(stream, text)
    case "done": return .end(.done, nil)
    case "error": return .end(.error, body["message"] as? String)
    case "loadError": return .end(.unavailable, body["message"] as? String)
    default: return nil
    }
  }

  private func armDeadline(seconds: UInt64, stop: CodeProgramResult.Stop) {
    deadline?.cancel()
    deadline = Task { [weak self] in
      do { try await Task.sleep(for: .seconds(seconds)) } catch { return }
      self?.finish(stop)
    }
  }

  private func finish(_ stop: CodeProgramResult.Stop) {
    deadline?.cancel()
    deadline = nil
    let page = webView
    page?.evaluateJavaScript("stopWorker()") { [page] _, _ in page?.stopLoading() }
    page?.configuration.userContentController.removeScriptMessageHandler(forName: "runner")
    page?.navigationDelegate = nil
    webView = nil
    result.stop = stop
    let pending = continuation
    continuation = nil
    pending?.resume(returning: result)
  }

  func webView(
    _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: any Error
  ) {
    guard webView === self.webView else { return }
    finish(.unavailable)
  }
  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
    guard webView === self.webView else { return }
    finish(.unavailable)
  }
}
