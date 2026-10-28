import SwiftUI

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
      },
      canvas: { context in
        ChartsFields(context: context) { RandomSimulationCanvas(context: context, fields: $0) }
      }
    ),
    ActivityRenderer(template: "numberLine") { context in
      ChartsFields(context: context) { NumberLineCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "lineCrossing",
      grade: { content, answer in
        (try? content.fields(as: LineCrossingFields.self)).map {
          LineCrossingModel.grade($0, answer)
        } ?? false
      },
      canvas: { context in
        ChartsFields(context: context) { LineCrossingCanvas(context: context, fields: $0) }
      }
    ),
    ActivityRenderer(template: "formulaModel") { context in
      ChartsFields(context: context) { FormulaModelCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "patternTable",
      grade: { content, answer in
        (try? content.fields(as: PatternTableFields.self))?.grade(answer) ?? false
      },
      canvas: { context in
        ChartsFields(context: context) { PatternTableCanvas(context: context, fields: $0) }
      }
    ),
    ActivityRenderer(
      template: "patternTester",
      grade: { content, answer in
        (try? content.fields(as: PatternTesterFields.self))?.grade(answer) ?? false
      },
      canvas: { context in
        ChartsFields(context: context) { PatternTesterCanvas(context: context, fields: $0) }
      }
    ),
    ActivityRenderer(template: "areaModel") { context in
      ChartsFields(context: context) { AreaModelCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "balance") { context in
      ChartsFields(context: context) { BalanceCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "unitCircle") { context in
      ChartsFields(context: context) { UnitCircleCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "geometryBoard") { context in
      ChartsFields(context: context) { GeometryBoardCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "moleculeBuilder",
      grade: { content, answer in
        guard let fields = try? content.fields(as: MoleculeBuilderFields.self),
          let target = MoleculeModel.parse(fields.formula),
          let build = try? answer.decode(as: MoleculeBuild.self), build.kind == "molecule"
        else {
          return false
        }

        return MoleculeModel.isComplete(build, target)
      },
      canvas: { context in
        ChartsFields(context: context) { MoleculeBuilderCanvas(context: context, fields: $0) }
      }
    ),
  ]
}

/// Content that doesn't decode (a template changed on the server before the app) leaves the canvas
/// out, and the check still works.
struct ChartsFields<Fields: Decodable, Canvas: View>: View {
  let context: ActivityCanvasContext
  @ViewBuilder let canvas: (Fields) -> Canvas

  var body: some View {
    if let fields = try? context.fields(as: Fields.self) {
      canvas(fields)
    }
  }
}
