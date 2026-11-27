import SwiftUI

enum ChartsActivities {
  static let renderers: [ActivityRenderer] = [
    ActivityRenderer(template: "chartReader") { context, fields in
      ChartReaderCanvas(context: context, fields: fields)
    },
    ActivityRenderer(template: "distributionExplorer") { context, fields in
      DistributionExplorerCanvas(context: context, fields: fields)
    },
    ActivityRenderer(
      template: "randomSimulation",
      badge: .by { content in
        if case .chance = try? content.fields(as: RandomSimulationFields.self) {
          return .predictFirst
        }
        return nil
      },
      // Chance mode asks for a guess first, then runs.
      showsCheckFirst: { content in
        if case .chance = try? content.fields(as: RandomSimulationFields.self) { return true }
        return false
      },
      canvas: { context, fields in
        RandomSimulationCanvas(context: context, fields: fields)
      }
    ),
    ActivityRenderer(template: "numberLine") { context, fields in
      NumberLineCanvas(context: context, fields: fields)
    },
    ActivityRenderer(
      template: "lineCrossing", badge: .always(.moveLine),
      grade: { content, answer in
        (try? content.fields(as: LineCrossingFields.self)).map {
          LineCrossingModel.grade($0, answer)
        } ?? false
      },
      canvas: { context, fields in
        LineCrossingCanvas(context: context, fields: fields)
      }
    ),
    ActivityRenderer(template: "formulaModel") { context, fields in
      FormulaModelCanvas(context: context, fields: fields)
    },
    ActivityRenderer(
      template: "patternTable",
      grade: { content, answer in
        (try? content.fields(as: PatternTableFields.self))?.grade(answer) ?? false
      },
      canvas: { context, fields in
        PatternTableCanvas(context: context, fields: fields)
      }
    ),
    ActivityRenderer(template: "patternTester") { context, fields in
      PatternTesterCanvas(context: context, fields: fields)
    },
    ActivityRenderer(template: "areaModel") { context, fields in
      AreaModelCanvas(context: context, fields: fields)
    },
    ActivityRenderer(template: "balance") { context, fields in
      BalanceCanvas(context: context, fields: fields)
    },
    ActivityRenderer(template: "unitCircle", badge: .always(.turnIt)) { context, fields in
      UnitCircleCanvas(context: context, fields: fields)
    },
    ActivityRenderer(template: "geometryBoard", badge: .always(.dragCorner)) { context, fields in
      GeometryBoardCanvas(context: context, fields: fields)
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
      canvas: { context, fields in
        MoleculeBuilderCanvas(context: context, fields: fields)
      }
    ),
  ]
}
