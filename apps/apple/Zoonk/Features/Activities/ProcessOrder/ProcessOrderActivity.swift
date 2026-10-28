import SwiftUI

extension ActivityRenderer {
  static let processOrder = ActivityRenderer(
    template: "processOrder",
    grade: ActivityExpectedAnswer.grader(ProcessOrderFields.self) { .order($0.steps.map(\.id)) }
  ) { context in
    if let fields = try? context.fields(as: ProcessOrderFields.self) {
      ProcessOrderCanvas(fields: fields, context: context)
    }
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

/// The steps of a process, shuffled, to put in order: drag a step to its place, or tap a step and
/// then the step whose place it takes; VoiceOver moves a step up or down from its actions. Once
/// checked, they show in their true order with why each needs the one before, and where the
/// learner had the ones out of place. Explored, they show in their true order with each one's why.
private struct ProcessOrderCanvas: View {
  let fields: ProcessOrderFields
  let context: ActivityCanvasContext

  @State private var order: [String]
  @State private var selectedId: String?
  @State private var targetedId: String?

  init(fields: ProcessOrderFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context

    let prompt =
      context.payload["prompt"].flatMap { if case .string(let text) = $0 { text } else { nil } }
      ?? ""
    _order = State(
      initialValue: context.answer?.ids
        ?? ProcessOrder.shuffled(
          fields.steps, seed: "\(prompt):\(fields.steps.map(\.id).joined(separator: ","))"
        )
        .map(\.id))
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

  // MARK: - Ordering

  private var answering: some View {
    let byId = Dictionary(fields.steps.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

    return VStack(alignment: .leading, spacing: 8) {
      ForEach(Array(order.enumerated()), id: \.element) { index, id in
        if let step = byId[id] {
          row(step, index: index)
        }
      }

      ActivityCaption(
        Text(
          "Drag the steps into order, or tap one and then its place.", tableName: "Activities",
          comment: "Under the steps of a process to put in order"))
    }
  }

  private func row(_ step: ProcessOrderFields.Step, index: Int) -> some View {
    let isSelected = selectedId == step.id

    return Button {
      if let selectedId, selectedId != step.id {
        move(selectedId, to: index)
      } else {
        selectedId = isSelected ? nil : step.id
      }
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        ProcessStepMarks(position: index + 1, icon: step.icon, mark: .plain)
        LessonRichText(step.text)
          .fontWeight(.medium)
          .frame(maxWidth: .infinity, alignment: .leading)
        Image(systemName: "line.3.horizontal")
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
      }
    }
    .buttonStyle(ActivityTileStyle(mark: isSelected ? .selected : .plain))
    .overlay {
      if targetedId == step.id {
        RoundedRectangle(cornerRadius: 12).strokeBorder(.primary, lineWidth: 2)
      }
    }
    .draggable(step.id)
    .dropDestination(for: String.self) { ids, _ in
      guard let id = ids.first, order.contains(id) else {
        return false
      }

      move(id, to: index)
      return true
    } isTargeted: { isTargeted in
      if isTargeted {
        targetedId = step.id
      } else if targetedId == step.id {
        targetedId = nil
      }
    }
    .accessibilityLabel(
      Text(
        "\(index + 1). \(LessonRichText.plain(step.text))", tableName: "Activities",
        comment: "VoiceOver: a step's place in the learner's order, then the step")
    )
    .accessibilityAddTraits(isSelected ? .isSelected : [])
    .accessibilityActions {
      if index > 0 {
        Button {
          move(step.id, to: index - 1)
        } label: {
          Text("Move up", tableName: "Activities", comment: "VoiceOver action on a step to order")
        }
      }

      if index < order.count - 1 {
        Button {
          move(step.id, to: index + 1)
        } label: {
          Text("Move down", tableName: "Activities", comment: "VoiceOver action on a step to order")
        }
      }
    }
  }

  private func move(_ id: String, to index: Int) {
    guard let from = order.firstIndex(of: id), from != index else {
      selectedId = nil
      return
    }

    order.remove(at: from)
    order.insert(id, at: index)
    selectedId = nil
    context.setAnswer(.order(order))

    let text = fields.steps.first { $0.id == id }.map { LessonRichText.plain($0.text) } ?? ""
    announceActivityChange(
      String(
        localized: "\(text) is now step \(index + 1).", table: "Activities",
        comment: "VoiceOver, after a step of a process moves"))
  }

  // MARK: - Solved

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

        HStack(alignment: .firstTextBaseline, spacing: 12) {
          ProcessStepMarks(position: index + 1, icon: step.icon, mark: mark)

          VStack(alignment: .leading, spacing: 4) {
            LessonRichText(step.text)
              .fontWeight(.medium)
            if let why = step.why {
              LessonRichText(why)
                .foregroundStyle(.secondary)
            }
            if mark == .wrong, let learnerPosition = result?.learnerPosition {
              Text(
                "You had it at \(learnerPosition)", tableName: "Activities",
                comment: "After the check: where the learner put a misplaced step"
              )
              .font(.footnote.weight(.medium))
              .foregroundStyle(.destructive)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.subheadline)
        .padding(12)
        .background(background(mark), in: .rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)
        .accessibilityValue(mark.verdict ?? Text(verbatim: ""))
      }
    }
  }

  private func background(_ mark: ActivityTileMark) -> Color {
    switch mark {
    case .right: Color.success.opacity(0.1)
    case .wrong: Color.destructive.opacity(0.1)
    default: Color(.secondarySystemBackground)
    }
  }
}

/// A step's number and picture, level with its first line.
private struct ProcessStepMarks: View {
  let position: Int
  let icon: String?
  let mark: ActivityTileMark

  @ScaledMetric(relativeTo: .subheadline) private var badge = 28.0

  var body: some View {
    HStack(spacing: 10) {
      Text(position, format: .number)
        .font(.footnote.weight(.semibold).monospacedDigit())
        .foregroundStyle(mark == .plain ? Color.primary : Color(.systemBackground))
        .frame(width: badge, height: badge)
        .background(fill, in: .circle)

      if let symbol = ProcessIcons.symbol(for: icon) {
        Image(systemName: symbol)
          .foregroundStyle(.secondary)
          .frame(width: badge)
      }
    }
    .accessibilityHidden(true)
  }

  private var fill: Color {
    switch mark {
    case .right: .success
    case .wrong: .destructive
    default: Color(.tertiarySystemFill)
    }
  }
}

/// The pure rules of ordering a process, as main's `process-order-model`.
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

  /// Each step in its true order, with where the learner put it.
  static func results(expected: [String], order: [String]) -> [StepResult] {
    expected.enumerated().map { index, id in
      StepResult(
        id: id, learnerPosition: order.firstIndex(of: id).map { $0 + 1 }, position: index + 1)
    }
  }
}
