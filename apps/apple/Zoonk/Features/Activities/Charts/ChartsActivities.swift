import SwiftUI

/// The chart, slider and plot templates (main's `activity-registry*.ts` entries for them), part of
/// `ActivityRendererRegistry.app`.
enum ChartsActivities {
  static let renderers: [ActivityRenderer] = [
    ActivityRenderer(template: "chartReader") { context in
      ChartsFields(context: context) { ChartReaderCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "distributionExplorer") { context in
      ChartsFields(context: context) { DistributionExplorerCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "randomSimulation",
      // Chance mode asks for a guess first, then runs.
      showsCheckFirst: { content in
        if case .chance = try? content.fields(as: RandomSimulationFields.self) { return true }
        return false
      }
    ) { context in
      ChartsFields(context: context) { RandomSimulationCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "numberLine") { context in
      ChartsFields(context: context) { NumberLineCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "lineCrossing",
      grade: { content, answer in
        (try? content.fields(as: LineCrossingFields.self)).map {
          LineCrossingModel.grade($0, answer)
        } ?? false
      }
    ) { context in
      ChartsFields(context: context) { LineCrossingCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "formulaModel") { context in
      ChartsFields(context: context) { FormulaModelCanvas(context: context, fields: $0) }
    },
  ]
}

/// Decodes a template's fields once and draws its canvas; content that doesn't decode (a template
/// changed on the server before the app) leaves the canvas out and the check still works.
struct ChartsFields<Fields: Decodable, Canvas: View>: View {
  let context: ActivityCanvasContext
  @ViewBuilder let canvas: (Fields) -> Canvas

  var body: some View {
    if let fields = try? context.fields(as: Fields.self) {
      canvas(fields)
    }
  }
}
