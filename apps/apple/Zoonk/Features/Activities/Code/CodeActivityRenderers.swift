import SwiftUI

enum CodeActivityRenderers {
  static let all: [ActivityRenderer] = [
    ActivityRenderer(template: "codeTracer", grade: gradeTracer) { context in
      if let fields = try? context.fields(as: CodeTracerFields.self) {
        CodeTracerCanvas(context: context, fields: fields)
      }
    },
    ActivityRenderer(template: "codeRunner", grade: gradeOutput) { context in
      if let fields = try? context.fields(as: CodeRunnerFields.self) {
        CodeRunnerCanvas(context: context, fields: fields)
      }
    },
    ActivityRenderer(template: "sqlPlayground", grade: gradeRows) { context in
      if let fields = try? context.fields(as: CodeSQLFields.self) {
        CodeSQLCanvas(context: context, fields: fields)
      }
    },
  ]

  private static func gradeOutput(_ content: ActivityStepContent, _ answer: ActivityAnswer) -> Bool
  {
    guard answer.kind == "output", let fields = try? content.fields(as: CodeRunnerFields.self),
      case .string(let output) = answer.value["output"]
    else { return false }
    return CodeActivityText.normalize(output) == CodeActivityText.normalize(fields.expectedOutput)
  }

  private static func gradeTracer(_ content: ActivityStepContent, _ answer: ActivityAnswer) -> Bool
  {
    guard answer.kind == "assignment", let fields = try? content.fields(as: CodeTracerFields.self),
      case .object(let pairs) = answer.value["pairs"], pairs.count == fields.pauses.count
    else { return false }
    return fields.pauses.enumerated().allSatisfy { index, pause in
      guard fields.trace.indices.contains(pause.step),
        let value = fields.trace[pause.step].values.first(where: { $0.name == pause.variable })
      else { return false }
      let expected = pause.options.first {
        $0.text.trimmingCharacters(in: .whitespacesAndNewlines)
          == CodeActivityText.display(value.value)
      }
      return expected.map { pairs[String(index)] == .string($0.id) } ?? false
    }
  }

  private static func gradeRows(_ content: ActivityStepContent, _ answer: ActivityAnswer) -> Bool {
    guard answer.kind == "rows", let fields = try? content.fields(as: CodeSQLFields.self),
      let result = try? answer.decode(as: CodeSQLResult.self)
    else { return false }
    return result.matches(fields.expected)
  }
}
