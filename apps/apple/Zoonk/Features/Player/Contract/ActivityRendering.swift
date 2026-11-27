import SwiftUI

/// `checked` is read-only, with the expected end state next to the learner's. `explore` is a template
/// on an explanation screen: nothing is asked or graded.
enum ActivityPhase: Hashable, Sendable {
  case answering
  case checked(isCorrect: Bool)
  case explore
}

/// The answer lives in the player's state, never in the canvas: the canvas shows `answer` and
/// reports changes with `setAnswer`.
struct ActivityCanvasContext {
  let template: String
  let payload: JSONValue
  /// Nil while exploring.
  let check: ActivityCheck?
  let phase: ActivityPhase
  let answer: ActivityAnswer?
  let setAnswer: @MainActor (ActivityAnswer?) -> Void
  /// Sets a finished answer and checks it once, for a canvas whose last move ends it (a match
  /// board's last pair), so there's no Check to press.
  let complete: @MainActor (ActivityAnswer) -> Void
  var baseMap: ActivityBaseMap?
  /// A numeric check's answer as the verdict writes it.
  var roundedAnswer: ActivityRoundedAnswer? = nil

  func fields<Fields: Decodable>(as type: Fields.Type = Fields.self) throws -> Fields {
    try (payload["fields"] ?? .null).decode(as: type)
  }
}

/// A renderer draws the canvas only; the player owns the prompt, the check and the feedback. An
/// `interaction` check's answer is the canvas's end state: the canvas calls `setAnswer` with it (nil
/// while it isn't an answer yet).
struct ActivityRenderer: Sendable {
  let template: String
  /// Mirrors main's `badge`: none for most templates.
  let badge: ActivityBadge.Rule?
  /// Mirrors main's `checkFirst`.
  let showsCheckFirst: @Sendable (ActivityStepContent) -> Bool
  /// Mirrors main's `answersOnCanvas`: the canvas takes the numeric answer itself, so the step asks
  /// no second question with a field of its own.
  let answersOnCanvas: Bool
  /// Computed like core's `checkActivityAnswer`, for instant feedback. Without it, the player waits
  /// for the server's verdict.
  let grade: (@Sendable (ActivityStepContent, ActivityAnswer) -> Bool)?
  let canAnswer: @Sendable (ActivityStepContent) -> Bool
  let canvas: @MainActor @Sendable (ActivityCanvasContext) -> AnyView

  init<Fields: Decodable & Sendable, Canvas: View>(
    template: String,
    badge: ActivityBadge.Rule? = nil,
    showsCheckFirst: @escaping @Sendable (ActivityStepContent) -> Bool = { _ in false },
    answersOnCanvas: Bool = false,
    grade: (@Sendable (ActivityStepContent, ActivityAnswer) -> Bool)? = nil,
    canAnswer: @escaping @Sendable (Fields) -> Bool = { _ in true },
    @ViewBuilder canvas: @escaping @MainActor @Sendable (ActivityCanvasContext, Fields) -> Canvas
  ) {
    self.template = template
    self.badge = badge
    self.showsCheckFirst = showsCheckFirst
    self.answersOnCanvas = answersOnCanvas
    self.grade = grade
    self.canAnswer = { content in
      (try? content.fields(as: Fields.self)).map(canAnswer) ?? false
    }
    self.canvas = { context in
      guard let fields = try? context.fields(as: Fields.self) else { return AnyView(EmptyView()) }
      return AnyView(
        canvas(context, fields)
          .frame(maxWidth: .infinity, alignment: .leading)
          .activityPanel())
    }
  }
}

struct ActivityRendererRegistry: Sendable {
  private let renderers: [String: ActivityRenderer]

  init(_ renderers: [ActivityRenderer]) {
    self.renderers = Dictionary(
      renderers.map { ($0.template, $0) }, uniquingKeysWith: { _, last in last })
  }

  func renderer(for template: String) -> ActivityRenderer? {
    renderers[template]
  }

  func isUnplayable(_ step: LessonStep) -> Bool {
    guard case .activity(let content) = step.content else { return false }
    let renderer = renderer(for: content.template)
    switch content.check {
    case .interaction:
      return renderer?.canAnswer(content) != true
    case .numeric where renderer?.answersOnCanvas == true:
      return renderer?.canAnswer(content) != true
    default:
      return false
    }
  }

  /// An activity step's instant grade, so its check doesn't wait for the server.
  func grade(for step: LessonStep) -> ((ActivityStepContent, ActivityAnswer) -> Bool)? {
    guard case .activity(let content) = step.content else {
      return nil
    }

    return renderer(for: content.template)?.grade
  }

  static let empty = ActivityRendererRegistry([])
}

extension EnvironmentValues {
  @Entry var activityRenderers: ActivityRendererRegistry = .empty
}

struct ActivityFallbackCanvas: View {
  let context: ActivityCanvasContext

  var body: some View {
    if case .interaction = context.check {
      StateMessage {
        Label {
          Text(
            "This activity isn't available in the app yet", tableName: "Player",
            comment: "An interactive activity the iOS app can't show yet")
        } icon: {
          Image(systemName: "hand.tap")
        }
      } description: {
        Text(
          "You can skip it and keep going.", tableName: "Player",
          comment: "Under an activity the app can't show yet")
      }
    }
  }
}
