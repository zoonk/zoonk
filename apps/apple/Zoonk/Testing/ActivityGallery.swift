#if DEBUG
  import SwiftUI

  /// A Debug-only page of activity screens, for looking at templates on a simulator without a
  /// backend or a lesson that uses them. Launch with `--activity-gallery` and the screens as JSON
  /// (`[PlayableLibraryStep]`, the API's shape) in `ZOONK_ACTIVITY_GALLERY`; the fixtures stay
  /// outside the app. Each screen plays like the player: answer, check (graded on the device the
  /// way the player grades), start over, or explore the canvas. `ZOONK_ACTIVITY_GALLERY_OPEN`
  /// opens one screen at launch; with `ZOONK_ACTIVITY_GALLERY_ANSWER` (a `LessonStepAnswer`) it
  /// starts answered and checked, and with `ZOONK_ACTIVITY_GALLERY_EXPLORE` it starts explored.
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
      content.fullScreenCover(isPresented: .constant(steps != nil)) {
        ActivityGallery(
          steps: steps ?? [],
          path: (steps ?? []).filter { $0.id == Self.environment["ZOONK_ACTIVITY_GALLERY_OPEN"] },
          answer: Self.environment["ZOONK_ACTIVITY_GALLERY_ANSWER"].flatMap {
            try? JSONDecoder().decode(LessonAnswer.self, from: Data($0.utf8))
          },
          isExploring: Self.environment["ZOONK_ACTIVITY_GALLERY_EXPLORE"] != nil)
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
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
          Picker(selection: $isExploring) {
            Text(verbatim: "Activity").tag(false)
            Text(verbatim: "Explore").tag(true)
          } label: {
            Text(verbatim: "Mode")
          }
          .pickerStyle(.segmented)

          if isExploring, let renderer = activityRenderers.renderer(for: content.template) {
            renderer.canvas(
              ActivityCanvasContext(
                template: content.template, payload: content.payload, check: nil, phase: .explore,
                answer: nil, setAnswer: { _ in }))
          } else {
            ActivityStepView(
              step: step, content: content,
              context: LessonStepContext(
                lessonId: "gallery", answer: answer, result: result, isLocked: result != nil,
                select: { answer = $0 }, resolveSpoken: { _ in }))
          }

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
        .padding()
        .id(run)
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

    private func check() {
      guard let answer else { return }
      let grade = LessonGrading.grade(
        answer, step: step, gradeActivity: activityRenderers.renderer(for: content.template)?.grade)
      result = grade.map { LessonStepResult($0) }
    }
  }
#endif
