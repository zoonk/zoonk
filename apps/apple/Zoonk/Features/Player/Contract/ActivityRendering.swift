import SwiftUI

/// Where an activity's canvas is. `answering` before the check and `checked` after it, read-only
/// with the expected end state next to the learner's. `explore` is a template on an explanation
/// screen: nothing is asked or graded, so the canvas is there to play with.
enum ActivityPhase: Hashable, Sendable {
  case answering
  case checked(isCorrect: Bool)
  case explore
}

/// What an activity canvas gets from the player. The answer lives in the player's state, never in
/// the canvas: the canvas shows `answer` and reports changes with `setAnswer`.
struct ActivityCanvasContext {
  let template: String
  /// The whole content as sent, for `fields(as:)`.
  let payload: JSONValue
  /// How the screen is answered; nil while exploring.
  let check: ActivityCheck?
  let phase: ActivityPhase
  let answer: ActivityAnswer?
  let setAnswer: @MainActor (ActivityAnswer?) -> Void

  /// The template's own fields, typed by the renderer.
  func fields<Fields: Decodable>(as type: Fields.Type = Fields.self) throws -> Fields {
    try (payload["fields"] ?? .null).decode(as: type)
  }
}

/// Draws one activity template. The player owns the prompt, the picture, the check's options or
/// number field, the Check button and the feedback; a renderer draws the canvas only.
///
/// A `choice` check is answered with the player's options and a `numeric` one with its number
/// field, so their canvases are for exploring. An `interaction` check's answer is the canvas's end
/// state: the canvas calls `setAnswer` with it (nil while it isn't an answer yet).
struct ActivityRenderer: Sendable {
  let template: String
  /// Whether the check's options or number field come before the canvas, as main's `checkFirst`.
  let showsCheckFirst: @Sendable (ActivityStepContent) -> Bool
  /// The verdict on an `interaction` answer, computed like core's `checkActivityAnswer`, for
  /// instant feedback. Without it, the player waits for the server's verdict.
  let grade: (@Sendable (ActivityStepContent, ActivityAnswer) -> Bool)?
  let canvas: @MainActor @Sendable (ActivityCanvasContext) -> AnyView

  init<Canvas: View>(
    template: String,
    showsCheckFirst: @escaping @Sendable (ActivityStepContent) -> Bool = { _ in false },
    grade: (@Sendable (ActivityStepContent, ActivityAnswer) -> Bool)? = nil,
    @ViewBuilder canvas: @escaping @MainActor @Sendable (ActivityCanvasContext) -> Canvas
  ) {
    self.template = template
    self.showsCheckFirst = showsCheckFirst
    self.grade = grade
    self.canvas = { context in AnyView(canvas(context)) }
  }
}

/// The activity renderers the app ships, by template. A template without one plays with
/// `ActivityFallbackCanvas`: a choice or numeric check still works from its question; an
/// interaction can't be answered, so the player lets the learner move past it.
struct ActivityRendererRegistry: Sendable {
  private let renderers: [String: ActivityRenderer]

  init(_ renderers: [ActivityRenderer]) {
    self.renderers = Dictionary(
      renderers.map { ($0.template, $0) }, uniquingKeysWith: { _, last in last })
  }

  func renderer(for template: String) -> ActivityRenderer? {
    renderers[template]
  }

  func adding(_ additions: [ActivityRenderer]) -> ActivityRendererRegistry {
    ActivityRendererRegistry(Array(renderers.values) + additions)
  }

  static let empty = ActivityRendererRegistry([])
}

extension EnvironmentValues {
  /// Set once at the app root: `.environment(\.activityRenderers, <the Activities registry>)`.
  @Entry var activityRenderers: ActivityRendererRegistry = .empty
}

/// The canvas of a template without a renderer: the data note only. Choice and numeric checks are
/// answered below it; an interaction says it can't be played here.
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
