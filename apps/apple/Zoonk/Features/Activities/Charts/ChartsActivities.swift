import SwiftUI

enum ChartsActivities {
  static let renderers: [ActivityRenderer] = [
    ActivityRenderer(template: "chartReader", badge: .always(.readChart)) { context in
      ChartsFields(context: context) { ChartReaderCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "distributionExplorer", badge: .always(.explore)) { context in
      ChartsFields(context: context) { DistributionExplorerCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "randomSimulation",
      badge: .by { content in
        if case .chance = try? content.fields(as: RandomSimulationFields.self) {
          return .predictFirst
        }
        return .simulate
      },
      // Chance mode asks for a guess first, then runs.
      showsCheckFirst: { content in
        if case .chance = try? content.fields(as: RandomSimulationFields.self) { return true }
        return false
      },
      canvas: { context in
        ChartsFields(context: context) { RandomSimulationCanvas(context: context, fields: $0) }
      }
    ),
    ActivityRenderer(template: "numberLine", badge: .always(.placeIt)) { context in
      ChartsFields(context: context) { NumberLineCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "lineCrossing", badge: .always(.moveCurve),
      grade: { content, answer in
        (try? content.fields(as: LineCrossingFields.self)).map {
          LineCrossingModel.grade($0, answer)
        } ?? false
      },
      canvas: { context in
        ChartsFields(context: context) { LineCrossingCanvas(context: context, fields: $0) }
      }
    ),
    ActivityRenderer(template: "formulaModel", badge: .always(.tryIt)) { context in
      ChartsFields(context: context) { FormulaModelCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "patternTable", badge: .always(.spotPattern),
      grade: { content, answer in
        (try? content.fields(as: PatternTableFields.self))?.grade(answer) ?? false
      },
      canvas: { context in
        ChartsFields(context: context) { PatternTableCanvas(context: context, fields: $0) }
      }
    ),
    ActivityRenderer(template: "patternTester", badge: .always(.testPattern)) { context in
      ChartsFields(context: context) { PatternTesterCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "areaModel", badge: .always(.splitIt)) { context in
      ChartsFields(context: context) { AreaModelCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "balance", badge: .always(.handsOn)) { context in
      ChartsFields(context: context) { BalanceCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "unitCircle", badge: .always(.turnIt)) { context in
      ChartsFields(context: context) { UnitCircleCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(template: "geometryBoard", badge: .always(.dragCorner)) { context in
      ChartsFields(context: context) { GeometryBoardCanvas(context: context, fields: $0) }
    },
    ActivityRenderer(
      template: "moleculeBuilder", badge: .always(.buildIt),
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
