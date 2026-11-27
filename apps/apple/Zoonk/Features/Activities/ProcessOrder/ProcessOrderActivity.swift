import SwiftUI

extension ActivityRenderer {
  static let processOrder = ActivityRenderer(
    template: "processOrder",
    grade: ActivityExpectedAnswer.grader(ProcessOrderFields.self) { .order($0.steps.map(\.id)) }
  ) { context, fields in
    ProcessOrderCanvas(fields: fields, context: context)
  }
}

struct ProcessOrderFields: Decodable, Hashable, Sendable {
  struct Step: Decodable, Hashable, Sendable, Identifiable {
    let icon: String?
    let id: String
    let text: String
    let why: String?
  }

  /// In their true order; the learner sees them shuffled.
  let steps: [Step]
}

private struct ProcessOrderCanvas: View {
  let fields: ProcessOrderFields
  let context: ActivityCanvasContext

  @ActivityState private var order: [String]
  @ActivityState("selectedId") private var selectedId: String? = nil

  init(fields: ProcessOrderFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context

    let prompt =
      context.payload["prompt"].flatMap { if case .string(let text) = $0 { text } else { nil } }
      ?? ""
    _order = ActivityState(
      wrappedValue: context.answer?.ids
        ?? ProcessOrder.shuffled(
          fields.steps, seed: "\(prompt):\(fields.steps.map(\.id).joined(separator: ","))"
        )
        .map(\.id), "order")
  }

  var body: some View {
    switch context.phase {
    case .answering:
      answering
    case .checked:
      solved(results: ProcessOrder.results(expected: fields.steps.map(\.id), order: order))
    case .explore:
      solved(results: nil)
    }
  }

  private var answering: some View {
    let byId = Dictionary(fields.steps.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

    return OrderSteps(
      order: order, selectedId: $selectedId, text: { byId[$0]?.text }, icon: { byId[$0]?.icon },
      onReorder: { moved in
        order = moved
        context.setAnswer(.order(moved))
      })
  }

  private func solved(results: [ProcessOrder.StepResult]?) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      if results != nil {
        ActivityCaption(
          Text(
            "The right order", tableName: "Activities",
            comment: "Above a process's steps, after the check"))
      }

      ForEach(Array(fields.steps.enumerated()), id: \.element.id) { index, step in
        let result = results?[index]
        let mark: ActivityTileMark =
          result.map { $0.learnerPosition == $0.position ? .right : .wrong } ?? .plain

        ProcessStepRow(position: index + 1, icon: step.icon, mark: mark) {
          VStack(alignment: .leading, spacing: 4) {
            LessonRichText(step.text)
              .typeWeight(.medium)
            if let why = step.why {
              LessonRichText(why)
                .foregroundStyle(.mutedForeground)
            }
            if mark == .wrong, let learnerPosition = result?.learnerPosition {
              Text(
                "You had it at \(learnerPosition)", tableName: "Activities",
                comment: "After the check: where the learner put a misplaced step"
              )
              .typeStyle(.note.weight(.medium))
              .foregroundStyle(.destructiveText)
            }
          }
        }
        .typeStyle(.body)
        .padding(12)
        .background(background(mark), in: .rect(cornerRadius: Radius.option))
        .accessibilityElement(children: .combine)
        .accessibilityValue(mark.verdict ?? Text(verbatim: ""))
      }
    }
  }

  private func background(_ mark: ActivityTileMark) -> Color {
    switch mark {
    case .right: Color.success.opacity(0.1)
    case .wrong: Color.destructive.opacity(0.1)
    default: Color.boxBackground
    }
  }
}

/// Mirrors main's `process-order-model`.
enum ProcessOrder {
  struct StepResult: Hashable {
    let id: String
    /// Where the learner put the step, 1-based, or nil when it isn't in their order.
    let learnerPosition: Int?
    let position: Int
  }

  /// The steps as the learner first sees them: shuffled the same way on every visit, and never
  /// already in the right order, so there is always something to do.
  static func shuffled<Step: Identifiable>(_ steps: [Step], seed: String) -> [Step] {
    let shuffled = SeededShuffle.shuffled(steps, seed: seed)
    let isInOrder = zip(shuffled, steps).allSatisfy { $0.id == $1.id }
    return isInOrder ? Array(shuffled.dropFirst() + shuffled.prefix(1)) : shuffled
  }

  static func results(expected: [String], order: [String]) -> [StepResult] {
    expected.enumerated().map { index, id in
      StepResult(
        id: id, learnerPosition: order.firstIndex(of: id).map { $0 + 1 }, position: index + 1)
    }
  }
}
