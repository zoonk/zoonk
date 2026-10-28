import Foundation

extension ActivityRendererRegistry {
  /// Every activity template the app draws, set once at the app root. A template missing here
  /// plays with the player's fallback canvas.
  static let app = ActivityRendererRegistry(
    [
      .argumentBuilder,
      .beforeAfter,
      .categorize,
      .causeEffectChain,
      .codeRunner,
      .codeTracer,
      .combinationGrid,
      .decisionTree,
      .dialogueSimulator,
      .findError,
      .guessReveal,
      .keyboardFretboard,
      .labeledDiagram,
      .mapExplorer,
      .matchPairs,
      .notationPlayer,
      .processOrder,
      .rhythmTapper,
      .sourceComparison,
      .sqlPlayground,
      .stepSolver,
      .timeline,
    ] + ChartsActivities.renderers)
}
