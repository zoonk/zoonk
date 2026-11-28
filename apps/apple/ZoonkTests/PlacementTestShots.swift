import SwiftUI
import XCTest

@testable import Zoonk

/// Review pictures of the placement tests' screens under their task bar, written only on demand:
/// `TEST_RUNNER_ZOONK_SHOTS=<folder> make -C apps/apple test ONLY_TESTING=ZoonkTests/PlacementTestShots`.
@MainActor
final class PlacementTestShots: XCTestCase {
  private let id = "00000000-0000-4000-8000-0000000000a1"

  func testWritesPictures() async throws {
    guard let path = ProcessInfo.processInfo.environment["ZOONK_SHOTS"] else {
      throw XCTSkip("Pass TEST_RUNNER_ZOONK_SHOTS=<folder> to write them")
    }

    // The ways out are found by what VoiceOver reads on ✕.
    try await readsWhatVoiceOverReads()
    let folder = URL(fileURLWithPath: path)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let session = SessionStore.preview()
    let cache = AppCache(session: session)
    let clients = APIClientFactory.live(baseURL: URL(string: "https://api.zoonk.test")!)
    let voice = VoiceServices(clients: clients, cache: cache)
    let offer = CoursePlacementOffer(estimatedMinutes: 4, questions: 8)
    let question = PracticeQuestion(
      itemId: id, format: .multipleChoice,
      question:
        "The best bid is $20.10 and the best ask is $20.12. You want to buy right now. What do you pay per share?",
      options: ["$20.10", "$20.12", "$20.11"])
    let listening = LevelTest.Question(
      id: id,
      options: [
        "Vai chegar amanhã à tarde no próximo voo.", "Vai chegar hoje mais tarde, de carro.",
        "Vai passar a noite toda esperando no aeroporto.",
        "Vai cancelar a viagem por causa da neve.",
      ],
      passage: "Oi, é o Dan.", question: "Qual é a principal mensagem de Dan?", skill: .listening,
      audio: .init(url: URL(string: "https://api.zoonk.test/a.mp3")!, durationMs: 9000),
      audioPending: false)
    var pending = listening
    pending.audioPending = true
    let store = PlanStore(api: PlanAPIStub(), cache: cache)
    let undo = PlacementResultUndo(
      goalId: id, changeId: id, lessons: 4, request: VisitRequest<Bool>(), plans: store,
      disabled: false)
    let nothingSkipped = PlacementTestEnd(
      lessonsSkipped: 0, chapter: "What a stock is",
      course: PlacementCourse(
        lessons: 9,
        chapters: [
          .init(lessons: 2, done: 0, skipped: 0, start: true),
          .init(lessons: 2, done: 0, skipped: 0, start: false),
          .init(lessons: 2, done: 0, skipped: 0, start: false),
          .init(lessons: 3, done: 0, skipped: 0, start: false),
        ]),
      nextLesson: .init(
        id: id, title: "Why companies sell shares", estimatedMinutes: 5,
        chapter: "What a stock is"))
    var languageResult = PlacementTestResult(finishedAt: .now, lessonsSkipped: 12)
    languageResult.ranges = [
      "reading": LevelRange(high: "B2", low: "B1"), "listening": LevelRange(high: "B1", low: "A2"),
    ]

    let screens: [(String, Bool, AnyView)] = [
      (
        "01-offer-onboarding", true,
        AnyView(
          TestOffer(
            cards: [
              TestCopy.courseCard(offer),
              TestCopy.firstLessonCard(title: "Why companies sell shares"),
            ],
            title: Text(TestCopy.whereToStart), description: Text(TestCopy.findsSkips),
            preselected: .quick,
            context: .init(goalID: id, test: .course, surface: .onboarding), isSaving: false,
            failed: false, onStart: { _ in }))
      ),
      (
        "02-offer-plan", true,
        AnyView(
          TestOffer(
            cards: [TestCopy.courseCard(offer)], title: Text(TestCopy.skipWhatYouKnow),
            description: Text(TestCopy.findsSkips), preselected: .quick,
            context: .init(goalID: id, test: .course, surface: .plan), isSaving: false,
            failed: false, onNotNow: {}, onStart: { _ in }))
      ),
      (
        "03-question", true,
        AnyView(
          PlacementQuestionScreen(
            subject: "How trading works", number: 2, total: 8, question: question,
            labels: .trueFalse, isSaving: false, failures: 0, onReport: {}, onAnswer: { _ in },
            onStop: {}))
      ),
      (
        "04-question-long-topic", false,
        AnyView(
          PlacementQuestionScreen(
            subject: "Investing for the long run while paying off your student loans",
            number: 1, total: 8, question: question, labels: .trueFalse, isSaving: false,
            failures: 0, onReport: {}, onAnswer: { _ in }, onStop: {}))
      ),
      (
        "05-question-large-text", false,
        AnyView(
          PlacementQuestionScreen(
            subject: "How trading works", number: 2, total: 8, question: question,
            labels: .trueFalse, isSaving: false, failures: 0, onReport: {}, onAnswer: { _ in },
            onStop: {}
          )
          .dynamicTypeSize(.accessibility2))
      ),
      (
        "06-listening", true,
        AnyView(
          LevelTestQuestionScreen(
            question: listening, number: 5, total: 12, canStop: true, targetLanguage: "pt",
            isSaving: false, failures: 0, onReport: {}, onAnswer: { _, _ in },
            onDeferAudio: {}, onStop: {}
          )
          .environment(voice))
      ),
      (
        "07-listening-large-text", false,
        AnyView(
          LevelTestQuestionScreen(
            question: listening, number: 5, total: 12, canStop: true, targetLanguage: "pt",
            isSaving: false, failures: 0, onReport: {}, onAnswer: { _, _ in },
            onDeferAudio: {}, onStop: {}
          )
          .environment(voice)
          .dynamicTypeSize(.accessibility2))
      ),
      (
        "08-listening-audio-pending", false,
        AnyView(
          LevelTestQuestionScreen(
            question: pending, number: 5, total: 12, canStop: true, targetLanguage: "pt",
            isSaving: false, failures: 0, onReport: {}, onAnswer: { _, _ in },
            onDeferAudio: {}, onStop: {}
          )
          .environment(voice))
      ),
      (
        "09-result", true,
        AnyView(
          PlacementTestResultView(
            end: PlacementTestRenderTests.startedPast, onboarding: false,
            pressed: nil, failed: false, undo: undo, onDone: {}))
      ),
      (
        "10-result-nothing-skipped", true,
        AnyView(
          PlacementTestResultView(
            end: nothingSkipped, onboarding: false, pressed: nil,
            failed: false, onDone: {}))
      ),
      (
        "10b-result-two-areas", true,
        AnyView(
          PlacementTestResultView(
            end: PlacementTestEnd(
              lessonsSkipped: 5, chapter: "Reading a balance sheet",
              course: PlacementCourse(
                lessons: 14,
                chapters: [
                  .init(lessons: 2, done: 0, skipped: 2, start: false),
                  .init(lessons: 3, done: 0, skipped: 0, start: true),
                  .init(lessons: 3, done: 0, skipped: 3, start: false),
                  .init(lessons: 2, done: 0, skipped: 0, start: false),
                  .init(lessons: 4, done: 0, skipped: 0, start: false),
                ]),
              nextLesson: .init(
                id: id, title: "Assets and liabilities", estimatedMinutes: 6,
                chapter: "Reading a balance sheet")),
            onboarding: false, pressed: nil, failed: false, onDone: {}))
      ),
      (
        "10c-result-studied-before-start", true,
        AnyView(
          PlacementTestResultView(
            end: PlacementTestEnd(
              lessonsSkipped: 2, chapter: "Why prices move",
              course: PlacementCourse(
                lessons: 11,
                chapters: [
                  .init(lessons: 2, done: 2, skipped: 0, start: false),
                  .init(lessons: 2, done: 2, skipped: 0, start: false),
                  .init(lessons: 2, done: 0, skipped: 2, start: false),
                  .init(lessons: 2, done: 0, skipped: 0, start: true),
                  .init(lessons: 3, done: 0, skipped: 0, start: false),
                ]),
              nextLesson: .init(
                id: id, title: "News, results and expectations", estimatedMinutes: 5,
                chapter: "Why prices move")),
            onboarding: false, pressed: nil, failed: false, onDone: {}))
      ),
      (
        "10d-result-studied-after-result", true,
        AnyView(
          PlacementTestResultView(
            end: PlacementTestEnd(
              lessonsSkipped: 4, chapter: "Reading the news",
              course: PlacementCourse(
                lessons: 12,
                chapters: [
                  .init(lessons: 2, done: 0, skipped: 2, start: false),
                  .init(lessons: 2, done: 0, skipped: 2, start: false),
                  .init(lessons: 2, done: 2, skipped: 0, start: false),
                  .init(lessons: 3, done: 1, skipped: 0, start: true),
                  .init(lessons: 3, done: 0, skipped: 0, start: false),
                ]),
              nextLesson: .init(
                id: id, title: "What earnings mean", estimatedMinutes: 6,
                chapter: "Reading the news"),
              revisited: true),
            onboarding: false, pressed: nil, failed: false, onDone: {}))
      ),
      (
        "10e-result-from-plan-take-again", true,
        AnyView(
          PlacementTestResultView(
            end: {
              var end = PlacementTestRenderTests.startedPast
              end.revisited = true
              return end
            }(), onboarding: false, pressed: nil, failed: false, undo: undo, onRetake: {},
            onDone: {}))
      ),
      (
        "11-result-no-course", false,
        AnyView(
          PlacementTestResultView(
            end: PlacementTestEnd(lessonsSkipped: 0, chapter: "What a stock is"),
            onboarding: true, pressed: nil, failed: false, onDone: {}))
      ),
      (
        "12-result-large-text", false,
        AnyView(
          PlacementTestResultView(
            end: PlacementTestRenderTests.startedPast, onboarding: false,
            pressed: nil, failed: false, undo: undo, onDone: {}
          )
          .dynamicTypeSize(.accessibility2))
      ),
      (
        "13-language-offer-onboarding", false,
        AnyView(
          TestOffer(
            cards: [
              TestCopy.testCard(label: "Level test", questions: 12, minutes: 6),
              TestCopy.firstLessonCard(title: nil),
            ],
            title: Text(TestCopy.whereToStart), description: Text(TestCopy.findsSkips),
            preselected: .quick,
            context: .init(goalID: id, test: .language, surface: .onboarding), isSaving: false,
            failed: false, onStart: { _ in }))
      ),
      (
        "14-language-offer-plan", false,
        AnyView(
          TestOffer(
            cards: [
              TestCopy.testCard(label: "Level test", questions: 12, minutes: 6),
              TestOfferCard(
                id: .testOut, label: "Test out of B2", line: "Skip B2 if you already know it"),
            ],
            title: Text(TestCopy.skipWhatYouKnow), description: Text(TestCopy.findsSkips),
            preselected: .quick,
            context: .init(goalID: id, test: .language, surface: .plan), isSaving: false,
            failed: false, onNotNow: {}, onStart: { _ in }))
      ),
      (
        "15-language-result", false,
        AnyView(
          LanguageTestResultView(
            result: languageResult, targetLanguage: "pt", testOutLevel: "B2", pressed: nil,
            failed: false, onContinue: {}, onTestOut: {}))
      ),
    ]

    for (name, inDark, screen) in screens {
      for scheme in inDark ? [ColorScheme.light, .dark] : [.light] {
        try await write(screen, scheme: scheme, name: name, in: folder)
      }
    }

    // The ways out behind ✕, from the second question on.
    let window = try host(
      PlacementQuestionScreen(
        subject: "How trading works", number: 2, total: 8, question: question,
        labels: .trueFalse, isSaving: false, failures: 0, onReport: {}, onAnswer: { _ in },
        onStop: {}), scheme: .light)
    try await waitForLayout(in: window)
    try await Task.sleep(for: .milliseconds(600))
    try await pressBarButton("Close", in: window)
    try await Task.sleep(for: .milliseconds(1200))
    try snapshot(window, to: folder.appending(path: "16-ways-out.light.png"))
    try measure("16-ways-out", in: folder)

    let focus = try host(
      PlacementQuestionScreen(
        subject: "Língua Inglesa", number: 3, total: 10, question: question, labels: .trueFalse,
        isSaving: false, failures: 0,
        stopHint: LocalizedStringResource(
          "Haven't studied most of this yet? That's fine. You can stop here and start learning.",
          table: "FocusTest"), onReport: {}, onAnswer: { _ in }, onStop: {}), scheme: .light)
    try await waitForLayout(in: focus)
    try await Task.sleep(for: .milliseconds(600))
    try await pressBarButton("Close", in: focus)
    try await Task.sleep(for: .milliseconds(1200))
    try snapshot(focus, to: folder.appending(path: "16b-ways-out-focus-hint.light.png"))
    focus.isHidden = true

    for (name, size) in [("17-button-icon-large-text", DynamicTypeSize.accessibility3)] {
      try await write(
        VStack {
          Spacer()
          BusyButton(isBusy: false, icon: .play) {
          } label: {
            Text(verbatim: "Responder mais perguntas")
          }
          .buttonStyle(.outline)
          .controlSize(.large)
          .buttonSizing(.flexible)
          .padding()
        }
        .dynamicTypeSize(size), scheme: .dark,
        to: folder.appending(path: "\(name).dark.png"))
    }
  }

  private func host(_ screen: some View, scheme: ColorScheme) throws -> UIWindow {
    let window = try show(
      NavigationStack {
        screen.testTask(name: Text(verbatim: "Test what you know")) {}
      }
      .environment(AppRouter())
      .zoonkStyles()
      .preferredColorScheme(scheme))
    window.overrideUserInterfaceStyle = scheme == .dark ? .dark : .light
    return window
  }

  private func write(_ screen: some View, scheme: ColorScheme, name: String, in folder: URL)
    async throws
  {
    try await write(
      screen, scheme: scheme,
      to: folder.appending(path: "\(name).\(scheme == .dark ? "dark" : "light").png"),
      measured: scheme == .light ? name : nil, in: folder)
  }

  private func write(
    _ screen: some View, scheme: ColorScheme, to file: URL, measured name: String? = nil,
    in folder: URL? = nil
  ) async throws {
    let window = try host(screen, scheme: scheme)
    try await waitForLayout(in: window)
    try await Task.sleep(for: .milliseconds(800))
    try snapshot(window, to: file)

    if let name, let folder {
      try measure(name, in: folder)
    }

    window.isHidden = true
  }

  /// The PR's key screens, phone and light, measured as `pr:media adopt` takes a render: the
  /// layout capture of the frame drawn, and the picture's bytes and build beside it. Only with
  /// `TEST_RUNNER_ZOONK_LAYOUT_CAPTURE=1`, into the folder's `measured/`.
  private func measure(_ name: String, in folder: URL) throws {
    let screens = [
      "01-offer-onboarding": "course-offer", "03-question": "course-question",
      "06-listening": "listening-question", "09-result": "course-result",
      "16-ways-out": "course-ways-out",
    ]

    guard LayoutCapture.isOn, let shot = screens[name] else { return }

    let measured = folder.appending(path: "measured")
    try FileManager.default.createDirectory(at: measured, withIntermediateDirectories: true)
    var capture = LayoutCaptureWriter.capture(
      scenario: shot, screen: shot, picture: measured.appending(path: "\(shot)-phone-light.png"))
    XCTAssertNil(capture["error"], "\(shot): \(capture["error"] ?? "")")

    var picture = try XCTUnwrap(capture["picture"] as? [String: Any])
    picture["build"] = capture["build"]
    capture["picture"] = picture
    try JSONSerialization.data(withJSONObject: capture, options: [.sortedKeys, .prettyPrinted])
      .write(to: measured.appending(path: "\(shot)-phone-light.json"))
  }

  private func snapshot(_ window: UIWindow, to file: URL) throws {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 3
    let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    try XCTUnwrap(image.pngData()).write(to: file)
  }
}
