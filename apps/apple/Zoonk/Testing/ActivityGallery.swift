#if DEBUG
  import SwiftUI

  /// Launch with `--activity-gallery` and the screens as `[PlayableLibraryStep]` JSON in
  /// `ZOONK_ACTIVITY_GALLERY`. `ZOONK_ACTIVITY_GALLERY_OPEN` opens one screen at launch; with
  /// `ZOONK_ACTIVITY_GALLERY_ANSWER` (a `LessonStepAnswer`) it starts answered and checked, and
  /// with `ZOONK_ACTIVITY_GALLERY_EXPLORE` it starts explored.
  struct ActivityGalleryLaunch: ViewModifier {
    private static let environment = ProcessInfo.processInfo.environment

    private let steps: [LessonStep]? = {
      guard ProcessInfo.processInfo.arguments.contains("--activity-gallery"),
        let json = ProcessInfo.processInfo.environment["ZOONK_ACTIVITY_GALLERY"]
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
            path: steps.filter { $0.id == Self.environment["ZOONK_ACTIVITY_GALLERY_OPEN"] },
            answer: Self.environment["ZOONK_ACTIVITY_GALLERY_ANSWER"].flatMap {
              try? JSONDecoder().decode(LessonAnswer.self, from: Data($0.utf8))
            },
            isExploring: Self.environment["ZOONK_ACTIVITY_GALLERY_EXPLORE"] != nil)
        }
      } else {
        content
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

    var body: some View {
      // The player's spread on wide screens, so a canvas shows at the trailing page's width.
      PaneSplit {
        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            modePicker
            part(.screen)
          }
          .padding()
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
            modePicker
            part(.screen)
            part(.turn)
            resultView
          }
          .padding()
          .id(run)
        }
      }
      .navigationTitle(Text(verbatim: content.template))
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
              answer: nil, setAnswer: { _ in }))
        }
      } else {
        ActivityStepView(
          step: step, content: content,
          context: LessonStepContext(
            lessonId: "gallery", studySessionId: nil, answer: answer, result: result,
            isLocked: result != nil,
            select: { answer = $0 }, resolveSpoken: { _ in }),
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
        Text(
          verbatim: [result.correctAnswer, result.feedback].compactMap { $0 }.joined(
            separator: "\n")
        )
        .font(.footnote)
      }
    }

    private func check() {
      guard let answer else { return }
      let grade = LessonGrading.grade(
        answer, step: step, gradeActivity: activityRenderers.renderer(for: content.template)?.grade)
      result = grade.map { LessonStepResult($0) }
    }
  }
#endif
