import Foundation

extension ActivityRendererRegistry {
  static let app = ActivityRendererRegistry(
    [
      .argumentBuilder,
      .beforeAfter,
      .categorize,
      .causeEffectChain,
      .codeRunner,
      .codeTracer,
      .combinationGrid,
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
