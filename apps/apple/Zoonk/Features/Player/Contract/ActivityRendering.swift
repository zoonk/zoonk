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

  func fields<Fields: Decodable>(as type: Fields.Type = Fields.self) throws -> Fields {
    try (payload["fields"] ?? .null).decode(as: type)
  }
}

/// A renderer draws the canvas only; the player owns the prompt, the check and the feedback. An
/// `interaction` check's answer is the canvas's end state: the canvas calls `setAnswer` with it (nil
/// while it isn't an answer yet).
struct ActivityRenderer: Sendable {
  let template: String
  /// Mirrors main's `badge`.
  let badge: ActivityBadge.Rule
  /// Mirrors main's `checkFirst`.
  let showsCheckFirst: @Sendable (ActivityStepContent) -> Bool
  /// Computed like core's `checkActivityAnswer`, for instant feedback. Without it, the player waits
  /// for the server's verdict.
  let grade: (@Sendable (ActivityStepContent, ActivityAnswer) -> Bool)?
  let canvas: @MainActor @Sendable (ActivityCanvasContext) -> AnyView

  init<Canvas: View>(
    template: String,
    badge: ActivityBadge.Rule,
    showsCheckFirst: @escaping @Sendable (ActivityStepContent) -> Bool = { _ in false },
    grade: (@Sendable (ActivityStepContent, ActivityAnswer) -> Bool)? = nil,
    @ViewBuilder canvas: @escaping @MainActor @Sendable (ActivityCanvasContext) -> Canvas
  ) {
    self.template = template
    self.badge = badge
    self.showsCheckFirst = showsCheckFirst
    self.grade = grade
    self.canvas = { context in AnyView(canvas(context)) }
  }
}

/// A template without a renderer plays with `ActivityFallbackCanvas`: an interaction can't be
/// answered, so the player lets the learner move past it.
struct ActivityRendererRegistry: Sendable {
  private let renderers: [String: ActivityRenderer]

  init(_ renderers: [ActivityRenderer]) {
    self.renderers = Dictionary(
      renderers.map { ($0.template, $0) }, uniquingKeysWith: { _, last in last })
  }

  func renderer(for template: String) -> ActivityRenderer? {
    renderers[template]
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
      ContentUnavailableView {
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
