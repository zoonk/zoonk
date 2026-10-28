import SwiftUI

extension ActivityRenderer {
  static let decisionTree = ActivityRenderer(
    template: "decisionTree",
    grade: ActivityExpectedAnswer.grader(DecisionTreeFields.self) { fields in
      DecisionTreeWalk.casePath(fields).map(ActivityExpectedAnswer.order)
    }
  ) { context in
    if let fields = try? context.fields(as: DecisionTreeFields.self) {
      DecisionTreeCanvas(fields: fields, context: context)
    }
  }
}

/// Walk a branching key one question at a time, using what the case says. Each answer narrows
/// what's still possible; Undo steps back. Reaching an outcome is the answer; after the check, the
/// walk is compared with the one code computes from the case.
private struct DecisionTreeCanvas: View {
  let fields: DecisionTreeFields
  let context: ActivityCanvasContext

  @State private var path: [String]
  @ScaledMetric(relativeTo: .body) private var branchWidth = 140.0

  init(fields: DecisionTreeFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context

    let ids = context.answer?.ids ?? []
    _path = State(initialValue: ids.first == fields.rootId ? ids : [fields.rootId])
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  var body: some View {
    let current = fields.node(path.last)
    let steps = DecisionTreeWalk.steps(fields, path: path)

    VStack(alignment: .leading, spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        Text(
          "The case", tableName: "Activities",
          comment: "Above the case a decision tree is walked for"
        )
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        LessonRichText(fields.case.description)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(12)
      .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
      .accessibilityElement(children: .combine)

      if case .question? = current {
        let possible = DecisionTreeWalk.reachableOutcomes(
          fields, from: current?.id ?? fields.rootId)

        VStack(alignment: .leading, spacing: 6) {
          Text(
            "Still possible", tableName: "Activities",
            comment: "Above the outcomes a decision tree can still reach"
          )
          .font(.caption.weight(.medium))
          .foregroundStyle(.secondary)
          Text(possible.map(\.label).joined(separator: " · "))
            .font(.subheadline)
        }
        .accessibilityElement(children: .combine)
      }

      if !steps.isEmpty {
        VStack(alignment: .leading, spacing: 8) {
          ForEach(Array(steps.enumerated()), id: \.offset) { _, step in
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Image(systemName: "checkmark")
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
              LessonRichText(step.question)
                .frame(maxWidth: .infinity, alignment: .leading)
              Text(step.branch)
                .chip()
            }
            .font(.subheadline)
            .accessibilityElement(children: .combine)
          }
        }
      }

      switch current {
      case .question(let node)? where !isChecked:
        VStack(alignment: .leading, spacing: 10) {
          HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(steps.count + 1, format: .number)
              .font(.subheadline.weight(.semibold).monospacedDigit())
              .foregroundStyle(.secondary)
              .accessibilityHidden(true)
            LessonRichText(node.question)
              .font(.headline)
              .accessibilityAddTraits(.isHeader)
          }

          LazyVGrid(
            columns: [GridItem(.adaptive(minimum: branchWidth), spacing: 8, alignment: .top)],
            alignment: .leading, spacing: 8
          ) {
            ForEach(Array(node.branches.enumerated()), id: \.element.next) { index, branch in
              Button {
                walk(path + [branch.next])
              } label: {
                Text(branch.label)
              }
              .buttonStyle(ActivityTileStyle(mark: .plain))
              .modifier(ActivityNumberKey(index: index))
            }
          }
        }
      case .outcome(let node)?:
        VStack(alignment: .leading, spacing: 2) {
          Text(
            "The key leads to", tableName: "Activities",
            comment: "Above the outcome a decision tree walk reached"
          )
          .font(.caption.weight(.semibold))
          .foregroundStyle(.secondary)
          Text(node.label)
            .font(.title3.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.mint.opacity(0.15), in: .rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)
      default:
        EmptyView()
      }

      if !isChecked, path.count > 1 {
        Button {
          walk(Array(path.dropLast()))
        } label: {
          Label {
            Text(
              "Undo", tableName: "Activities", comment: "Steps back one answer in a decision tree")
          } icon: {
            Image(systemName: "arrow.uturn.backward")
          }
        }
        .buttonStyle(.bordered)
      }

      if isChecked, let expected = DecisionTreeWalk.casePath(fields) {
        review(expected: expected)
      }
    }
  }

  private func walk(_ next: [String]) {
    path = next

    if case .outcome(let node)? = fields.node(next.last) {
      context.setAnswer(.order(next))
      announceActivityChange(
        String(
          localized: "The key leads to \(node.label).", table: "Activities",
          comment: "VoiceOver, once a decision tree walk reaches an outcome"))
    } else {
      context.setAnswer(nil)
    }
  }

  /// The walk code computed from the case, question by question, with the first place the
  /// learner's walk left it.
  private func review(expected: [String]) -> some View {
    let divergence = DecisionTreeWalk.firstDivergence(expected: expected, walked: path)
    let steps = DecisionTreeWalk.steps(fields, path: expected)
    let learnerSteps = DecisionTreeWalk.steps(fields, path: path)
    let missedAt = divergence.map { $0 - 1 } ?? steps.count

    return VStack(alignment: .leading, spacing: 8) {
      Text(
        "The walk for this case", tableName: "Activities",
        comment: "Above the right walk of a decision tree"
      )
      .font(.subheadline.weight(.semibold))

      ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Group {
            if index < missedAt {
              Image(systemName: "checkmark").foregroundStyle(Color.success)
            } else if index == missedAt {
              Image(systemName: "xmark").foregroundStyle(Color.destructive)
            } else {
              Image(systemName: "circle").foregroundStyle(.tertiary)
            }
          }
          .accessibilityHidden(true)

          VStack(alignment: .leading, spacing: 2) {
            LessonRichText(step.question)
            Text(step.branch)
              .fontWeight(.semibold)
            if index == missedAt, let learnerBranch = learnerSteps[safe: index]?.branch {
              Text(
                "You chose \(learnerBranch)", tableName: "Activities",
                comment: "After the check: the branch the learner took where the walk went wrong"
              )
              .foregroundStyle(.destructive)
            }
          }
        }
        .font(.subheadline)
        .accessibilityElement(children: .combine)
      }

      if case .outcome(let node)? = fields.node(expected.last) {
        Text(
          "It leads to \(node.label).", tableName: "Activities",
          comment: "After the check: the outcome the right walk of a decision tree reaches"
        )
        .font(.subheadline.weight(.semibold))
      }
    }
  }
}

extension Array {
  fileprivate subscript(safe index: Int) -> Element? {
    indices.contains(index) ? self[index] : nil
  }
}
