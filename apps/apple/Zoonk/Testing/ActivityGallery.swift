#if DEBUG
  import HTTPTypes
  import OpenAPIRuntime
  import SwiftUI

  /// Launch with `--activity-gallery` and the screens as `[PlayableLibraryStep]` JSON in
  /// `ZOONK_ACTIVITY_GALLERY`. `ZOONK_ACTIVITY_GALLERY_OPEN` opens one screen at launch; with
  /// `ZOONK_ACTIVITY_GALLERY_ANSWER` (a `LessonStepAnswer`) it starts answered and checked, and
  /// with `ZOONK_ACTIVITY_GALLERY_EXPLORE` it starts explored. `ZOONK_ACTIVITY_GALLERY_CODE_RUN`
  /// answers a run on our servers (`GalleryCodeRun`). Each is also a launch argument.
  struct ActivityGalleryLaunch: ViewModifier {
    private let steps: [LessonStep]? = {
      guard ProcessInfo.processInfo.arguments.contains("--activity-gallery"),
        let json = debugLaunchValue("ZOONK_ACTIVITY_GALLERY")
      else {
        return nil
      }

      do {
        return try JSONDecoder().decode([LessonStep].self, from: Data(json.utf8))
      } catch {
        preconditionFailure("ZOONK_ACTIVITY_GALLERY must hold activity steps: \(error)")
      }
    }()

    func body(content: Content) -> some View {
      if let steps {
        content.fullScreenCover(isPresented: .constant(true)) {
          ActivityGallery(
            steps: steps,
            path: steps.filter { $0.id == debugLaunchValue("ZOONK_ACTIVITY_GALLERY_OPEN") },
            answer: debugLaunchValue("ZOONK_ACTIVITY_GALLERY_ANSWER").flatMap {
              try? JSONDecoder().decode(LessonAnswer.self, from: Data($0.utf8))
            },
            isExploring: debugLaunchValue("ZOONK_ACTIVITY_GALLERY_EXPLORE") != nil
          )
          .zoonkStyles()
          .transformEnvironment(\.codeRuns) { codeRuns in
            if let run = GalleryCodeRun.launched {
              codeRuns = run.codeRuns
            }
          }
        }
      } else {
        content
      }
    }
  }

  /// What `/v1/code-runs` answers, as JSON: `{"status": 200, "body": "<the SSE events>",
  /// "eventDelayMs": 700}`, an error's status and body, or `{"offline": true}`. Each run sends
  /// one event every `eventDelayMs`.
  private struct GalleryCodeRun: Decodable, Sendable {
    var status = 200
    var body = ""
    var eventDelayMs = 0
    var offline = false

    static let launched = debugLaunchValue("ZOONK_ACTIVITY_GALLERY_CODE_RUN").map {
      do {
        return try JSONDecoder().decode(Self.self, from: Data($0.utf8))
      } catch {
        preconditionFailure("ZOONK_ACTIVITY_GALLERY_CODE_RUN must be a code run's answer: \(error)")
      }
    }

    private enum CodingKeys: CodingKey {
      case status, body, eventDelayMs, offline
    }

    init(from decoder: any Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      status = try container.decodeIfPresent(Int.self, forKey: .status) ?? 200
      body = try container.decodeIfPresent(String.self, forKey: .body) ?? ""
      eventDelayMs = try container.decodeIfPresent(Int.self, forKey: .eventDelayMs) ?? 0
      offline = try container.decodeIfPresent(Bool.self, forKey: .offline) ?? false
    }

    var codeRuns: CodeRuns {
      let api = CodeRunAPI(
        clients: APIClientFactory(
          baseURL: URL(string: "https://api.zoonk.test")!, transport: Transport(run: self)))

      return CodeRuns { request in
        do {
          return try await api.run(request, token: nil)
        } catch APIError.network {
          return .offline
        } catch {
          return .unavailable
        }
      }
    }

    private struct Transport: ClientTransport {
      let run: GalleryCodeRun

      func send(
        _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
      ) async throws -> (HTTPResponse, HTTPBody?) {
        if run.offline {
          throw URLError(.notConnectedToInternet)
        }

        var headerFields = HTTPFields()
        headerFields[.contentType] = run.status == 200 ? "text/event-stream" : "application/json"
        let events = run.body.components(separatedBy: "\n\n").filter { !$0.isEmpty }
        let delay = Duration.milliseconds(run.eventDelayMs)
        let stream = AsyncThrowingStream<ArraySlice<UInt8>, any Error> { continuation in
          let task = Task {
            for event in events {
              try await Task.sleep(for: delay)
              continuation.yield(ArraySlice("\(event)\n\n".utf8))
            }
            continuation.finish()
          }
          continuation.onTermination = { _ in task.cancel() }
        }

        return (
          HTTPResponse(status: .init(code: run.status), headerFields: headerFields),
          HTTPBody(stream, length: .unknown, iterationBehavior: .single)
        )
      }
    }
  }

  private struct ActivityGallery: View {
    let steps: [LessonStep]
    @State var path: [LessonStep]
    let answer: LessonAnswer?
    let isExploring: Bool

    var body: some View {
      NavigationStack(path: $path) {
        List(steps) { step in
          if case .activity(let content) = step.content {
            NavigationLink(value: step) {
              LabeledContent(content.template, value: step.id)
            }
          }
        }
        .navigationTitle(Text(verbatim: "Activities"))
        .navigationDestination(for: LessonStep.self) { step in
          if case .activity(let content) = step.content {
            ActivityGalleryScreen(
              step: step, content: content, answer: answer, isExploring: isExploring)
          }
        }
      }
    }
  }

  private struct ActivityGalleryScreen: View {
    @Environment(\.activityRenderers) private var activityRenderers

    let step: LessonStep
    let content: ActivityStepContent
    @State var answer: LessonAnswer?
    @State var isExploring: Bool

    @State private var result: LessonStepResult?
    @State private var run = 0
    @State private var work = ActivityWork()

    var body: some View {
      // The player's spread on wide screens, so a canvas shows on the page and at the width the
      // player gives it.
      PaneSplit {
        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            title
            modePicker
            part(.screen)
          }
          .padding()
          .id(run)
        }
      } secondary: {
        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            part(.turn)
            resultView
          }
          .padding()
          .id(run)
        }
      } single: {
        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            title
            modePicker
            part(.screen)
            part(.turn)
            resultView
          }
          .padding()
          .id(run)
        }
      }
      .pageColumn()
      .environment(work)
      // The page's own title, on the column's edge as every page's is, not the bar's large title.
      .navigationBarTitleDisplayMode(.inline)
      .onAppear {
        if answer != nil, result == nil {
          check()
        }
      }
      .toolbar {
        ToolbarItem {
          Button {
            answer = nil
            result = nil
            run += 1
            work = ActivityWork()
          } label: {
            Label {
              Text(verbatim: "Start over")
            } icon: {
              Image(systemName: "arrow.counterclockwise")
            }
          }
        }
        ToolbarItem {
          Button(action: check) {
            Label {
              Text(verbatim: "Check")
            } icon: {
              Image(systemName: "checkmark")
            }
          }
          .disabled(answer == nil || result != nil)
        }
      }
    }

    private var title: some View {
      PageHeader(Text(verbatim: content.template))
    }

    private var modePicker: some View {
      Picker(selection: $isExploring) {
        Text(verbatim: "Activity").tag(false)
        Text(verbatim: "Explore").tag(true)
      } label: {
        Text(verbatim: "Mode")
      }
      .pickerStyle(.segmented)
    }

    @ViewBuilder
    private func part(_ part: LessonStepPart) -> some View {
      if isExploring {
        if part == .turn, let renderer = activityRenderers.renderer(for: content.template) {
          renderer.canvas(
            ActivityCanvasContext(
              template: content.template, payload: content.payload, check: nil, phase: .explore,
              answer: nil, setAnswer: { _ in }, complete: { _ in }, baseMap: content.baseMap))
        }
      } else {
        ActivityStepView(
          step: step, content: content,
          context: LessonStepContext(
            lessonId: "gallery", answer: answer, result: result,
            isLocked: result != nil, waitsForPicture: false,
            select: { answer = $0 }, resolveSpoken: { _ in }, check: nil,
            complete: { answer = $0 }),
          part: part)
      }
    }

    @ViewBuilder
    private var resultView: some View {
      if let result {
        Label {
          Text(verbatim: result.isCorrect ? "Right" : "Not quite")
        } icon: {
          Image(systemName: result.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
        }
        .foregroundStyle(result.isCorrect ? Color.success : .destructive)
        // As the player's verdict: a canvas that takes the number shows the real value itself.
        Text(
          verbatim: [answersOnCanvas ? nil : result.correctAnswer, result.feedback]
            .compactMap { $0 }.joined(separator: "\n")
        )
        .typeStyle(.note)
      }
    }

    private var answersOnCanvas: Bool {
      activityRenderers.renderer(for: content.template)?.answersOnCanvas == true
    }

    private func check() {
      guard let answer else { return }
      let grade = LessonGrading.grade(
        answer, step: step, gradeActivity: activityRenderers.renderer(for: content.template)?.grade)
      result = grade.map { LessonStepResult($0) }
    }
  }
#endif
