import SwiftUI

extension ActivityRenderer {
  static let stepSolver = ActivityRenderer(
    template: "stepSolver",
    grade: ActivityExpectedAnswer.grader(StepSolverFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: StepSolverFields.self) {
      StepSolverCanvas(fields: fields, context: context)
    }
  }
}

struct StepSolverFields: Decodable, Hashable, Sendable {
  struct Choice: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let isCorrect: Bool
    let reason: String
    let text: String
  }

  struct Step: Decodable, Hashable, Sendable, Identifiable {
    let choices: [Choice]
    let id: String
    let math: String
    let prompt: String
    let unit: String?
    /// What the step's expression gives; the validator checks it before publishing.
    let value: Double

    var correct: Choice? {
      choices.first(where: \.isCorrect)
    }
  }

  let problem: String
  let steps: [Step]

  /// Each step's right move.
  var expected: ActivityExpectedAnswer {
    .assignment(
      Dictionary(
        steps.map { ($0.id, $0.correct?.id ?? "") }, uniquingKeysWith: { first, _ in first }))
  }
}

/// The pure rules of a step solver, as main's `step-solver-progress`: picks per step in order, the
/// first one counting.
enum StepSolver {
  typealias Picks = [String: [String]]

  /// The first step still waiting for its right move, or the step count when all are solved.
  static func currentIndex(_ steps: [StepSolverFields.Step], picks: Picks) -> Int {
    steps.firstIndex { step in
      guard let correct = step.correct?.id else { return true }
      return !(picks[step.id] ?? []).contains(correct)
    } ?? steps.count
  }

  /// The answer once every step is solved: each step's first pick, so finding the right move after
  /// a wrong one still teaches but doesn't count as knowing it.
  static func firstPicks(_ steps: [StepSolverFields.Step], picks: Picks) -> [String: String]? {
    guard currentIndex(steps, picks: picks) == steps.count else {
      return nil
    }

    return Dictionary(
      steps.map { ($0.id, picks[$0.id]?.first ?? "") }, uniquingKeysWith: { first, _ in first })
  }

  static func adding(_ picks: Picks, stepId: String, choiceId: String) -> Picks {
    var next = picks

    if !(next[stepId] ?? []).contains(choiceId) {
      next[stepId, default: []].append(choiceId)
    }

    return next
  }
}

/// A problem solved one step at a time: the learner picks each next move and sees it as a bar and
/// as math. Wrong picks explain themselves and can be retried, but the answer keeps each step's
/// first pick. A numeric check reads the value of its target step.
private struct StepSolverCanvas: View {
  let fields: StepSolverFields
  let context: ActivityCanvasContext

  @State private var picks: StepSolver.Picks = [:]

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  var body: some View {
    let current =
      isChecked ? fields.steps.count : StepSolver.currentIndex(fields.steps, picks: picks)
    let maxValue = fields.steps.map { abs($0.value) }.max() ?? 0

    VStack(alignment: .leading, spacing: 16) {
      LessonRichText(fields.problem)
        .fontWeight(.medium)

      ForEach(Array(fields.steps.enumerated()), id: \.element.id) { index, step in
        stepView(step, index: index, current: current, maxValue: maxValue)
      }
    }
  }

  @ViewBuilder
  private func stepView(_ step: StepSolverFields.Step, index: Int, current: Int, maxValue: Double)
    -> some View
  {
    let stepPicks = picks[step.id] ?? []
    let isDone = index < current
    let isCurrent = index == current
    let isFirstPickWrong = stepPicks.first.map { $0 != step.correct?.id } ?? false
    let wrongPicks = step.choices.filter { stepPicks.contains($0.id) && !$0.isCorrect }

    HStack(alignment: .firstTextBaseline, spacing: 12) {
      StepSolverMarker(
        number: index + 1, isDone: isDone, isCurrent: isCurrent,
        isWrong: isChecked && isFirstPickWrong)

      VStack(alignment: .leading, spacing: 10) {
        Group {
          if isDone, let correct = step.correct {
            LessonRichText(correct.text)
          } else {
            LessonRichText(step.prompt)
          }
        }
        .font(isDone || isCurrent ? .body.weight(.semibold) : .body)
        .foregroundStyle(isDone || isCurrent ? .primary : .secondary)

        if isCurrent, !isChecked {
          VStack(spacing: 8) {
            ForEach(Array(step.choices.enumerated()), id: \.element.id) { choiceIndex, choice in
              let isPicked = stepPicks.contains(choice.id)

              Button {
                pick(choice.id, on: step)
              } label: {
                LessonRichText(choice.text)
              }
              .buttonStyle(ActivityTileStyle(mark: isPicked ? .wrong : .plain))
              .disabled(isPicked)
              .modifier(ActivityNumberKey(index: choiceIndex))
            }
          }

          if let lastWrong = wrongPicks.last {
            LessonRichText(lastWrong.reason)
              .font(.subheadline)
              .foregroundStyle(.destructive)
          }
        }

        if isDone, let correct = step.correct {
          StepSolverWork(step: step, maxValue: maxValue)
          LessonRichText(correct.reason)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        if isChecked, isFirstPickWrong, let first = wrongPicks.first {
          Text(
            "Your first pick: \(LessonRichText.plain(first.text))", tableName: "Activities",
            comment: "After the check: the move the learner first picked on a step, which was wrong"
          )
          .font(.subheadline.weight(.medium))
          .foregroundStyle(.destructive)
        }
      }
    }
  }

  private func pick(_ choiceId: String, on step: StepSolverFields.Step) {
    let next = StepSolver.adding(picks, stepId: step.id, choiceId: choiceId)
    picks = next

    if let choice = step.choices.first(where: { $0.id == choiceId }) {
      announceActivityChange(LessonRichText.plain(choice.isCorrect ? step.math : choice.reason))
    }

    guard let pairs = StepSolver.firstPicks(fields.steps, picks: next) else {
      context.setAnswer(nil)
      return
    }

    switch context.check {
    case .numeric(_, _, _, _, _, _, let output):
      let target = output.flatMap { id in fields.steps.first { $0.id == id } } ?? fields.steps.last
      context.setAnswer(target.map { .numeric($0.value) })
    default:
      context.setAnswer(.assignment(pairs))
    }
  }
}

/// A step's mark on the line of steps: done (soft blue, pink when its first pick was wrong), the
/// current one in ink, later ones dashed.
private struct StepSolverMarker: View {
  let number: Int
  let isDone: Bool
  let isCurrent: Bool
  let isWrong: Bool

  @ScaledMetric(relativeTo: .subheadline) private var size = 30.0

  var body: some View {
    Group {
      if isDone {
        Image(systemName: isWrong ? "xmark" : "checkmark")
          .fontWeight(.bold)
          .foregroundStyle(Color(.systemBackground))
          .frame(width: size, height: size)
          .background(isWrong ? Color.destructive : Color.success, in: .circle)
      } else {
        Text(number, format: .number)
          .font(.subheadline.weight(.semibold).monospacedDigit())
          .foregroundStyle(isCurrent ? Color(.systemBackground) : .secondary)
          .frame(width: size, height: size)
          .background(isCurrent ? Color.primary : .clear, in: .circle)
          .overlay {
            if !isCurrent {
              Circle().strokeBorder(
                Color(.separator), style: StrokeStyle(lineWidth: 2, dash: [3, 3]))
            }
          }
      }
    }
    .accessibilityHidden(true)
  }
}

/// A solved step's value as a bar against the biggest value in the problem, with its math.
private struct StepSolverWork: View {
  let step: StepSolverFields.Step
  let maxValue: Double

  @ScaledMetric(relativeTo: .caption) private var barHeight = 10.0

  var body: some View {
    let share = maxValue == 0 ? 0.04 : max(abs(step.value) / maxValue, 0.04)

    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 8) {
        Capsule()
          .fill(Color.mint)
          .frame(height: barHeight)
          .containerRelativeFrame(.horizontal) { width, _ in width * 0.6 * share }

        Text(ActivityNumberFormat.format(step.value, unit: step.unit))
          .font(.subheadline.weight(.semibold).monospacedDigit())
      }
      .accessibilityHidden(true)

      LessonRichText(step.math)
        .font(.body.monospaced())
    }
  }
}
