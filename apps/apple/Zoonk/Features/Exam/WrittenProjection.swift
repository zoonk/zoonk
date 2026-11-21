import SwiftUI

/// A written part's points: its range against its own minimum, and each task's. Ranges are nil
/// until that task has an independent first draft with a numeric grade.
struct WrittenPartPoints: Hashable, Decodable, Sendable {
  enum Standing: String, Decodable, Sendable {
    case below
    case met
    case overlaps
    case unmeasured
  }

  struct Task: Hashable, Decodable, Sendable, Identifiable {
    var key: String
    var max: Double?
    var name: String
    var range: WritingRange?
    var writingTask: WritingTaskName?

    var id: String { key }
  }

  var decimals: Int?
  var max: Double?
  var minimum: PointsMinimum?
  var name: String
  var range: WritingRange?
  /// Nil from a server before it said; then a part measured in points is in points.
  var scale: WritingScale?
  /// Nil when the part has no minimum.
  var standing: Standing?
  var tasks: [Task]

  var shownScale: WritingScale { scale ?? (range != nil ? .points : .levels) }
}

/// Whether a written part can be estimated in points yet, or its answers are graded by level.
enum WritingScale: String, Decodable, Sendable {
  case levels
  case points
}

/// The exam's projected score with its written part: a total once every part is measured.
struct WrittenProjection: Hashable, Decodable, Sendable {
  var combined: WritingRange?
  var max: Double?
  var objective: WritingRange?
  var objectiveMax: Double?
  var parts: [WrittenPartPoints]

  /// What the sheet leads with in place of a total: a part below its minimum, or one not measured.
  enum Headline: Equatable {
    case below(WrittenPartPoints)
    case unmeasured(WrittenPartPoints)
  }

  /// A part graded by level has no points to wait for, so the headline never says it's waiting.
  var headline: Headline? {
    if let below = parts.first(where: { $0.standing == .below }) {
      return .below(below)
    }

    if let unmeasured = parts.first(where: {
      $0.shownScale == .points && ($0.standing == .unmeasured || $0.range == nil)
    }) {
      return .unmeasured(unmeasured)
    }

    return nil
  }

  /// Writing is what moves a part not measured yet, or one below its minimum.
  var needsWriting: Bool {
    parts.contains { $0.range == nil || $0.standing == .below }
  }
}

/// The exam's projected score: the objective test and each written part on its own scale, a total
/// once every part is measured, the part still missing or below its own minimum otherwise. Never 0,
/// never the objective's percent copied (main's `WrittenProjectionScore`).
struct WrittenProjectionSections: View {
  let projection: WrittenProjection
  let goalId: String

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        Text("Estimated score", tableName: "Plan", comment: "The exam's projected score")
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)

        switch projection.headline {
        case .below(let part):
          // A part's name comes from the notice, so it opens a sentence rather than sitting inside one.
          Text(
            "Below the minimum to pass", tableName: "Plan",
            comment: "A written part's projected points are below its own minimum"
          )
          .typeStyle(.stepHeading)
          if let minimum = part.minimum {
            Group {
              if minimum.unit == .percent {
                Text(
                  "\(part.name) asks for \(WritingLabels.share(minimum.value / 100)) of its points, whatever your other scores.",
                  tableName: "Plan", comment: "Why a part's own minimum matters, as a share")
              } else {
                Text(
                  "\(part.name) asks for \(WritingLabels.points(minimum.value)) points, whatever your other scores.",
                  tableName: "Plan", comment: "Why a part's own minimum matters")
              }
            }
            .foregroundStyle(.mutedForeground)
          }
        case .unmeasured(let part):
          unmeasured(part)
            .foregroundStyle(.mutedForeground)
        case nil:
          if let combined = projection.combined, let max = projection.max {
            PointsReadout(range: combined, max: max, decimals: 0)
          }
        }
      }
      .padding(.vertical, 4)

      ScoreRow(
        name: Text("Objective test", tableName: "Plan", comment: "The exam's objective test"),
        range: projection.objective, max: projection.objectiveMax)

      ForEach(projection.parts, id: \.name) { part in
        ScoreRow(
          name: Text(part.name), range: part.range, max: part.max, decimals: part.decimals,
          levels: part.shownScale == .levels,
          minimum: part.minimum.flatMap { minimum in
            part.max.map { minimum.unit == .percent ? minimum.value / 100 * $0 : minimum.value }
          }
        ) {
          PartStanding(part: part)
        }
      }
    } footer: {
      if projection.needsWriting {
        WriteNowAction(goalId: goalId)
          .padding(.top, 12)
      }
    }
  }

  /// "Written test, half your final score, isn't measured yet.": the part's share of the exam's
  /// points, when both are known.
  private func unmeasured(_ part: WrittenPartPoints) -> Text {
    guard let partMax = part.max, let max = projection.max, max > 0 else {
      return Text(
        "\(part.name) isn't measured yet.", tableName: "Plan",
        comment: "A written part with no graded answer yet")
    }

    let share = partMax / max

    return share == 0.5
      ? Text("\(part.name), half your final score, isn't measured yet.", tableName: "Plan")
      : Text(
        "\(part.name), \(WritingLabels.share(share)) of your final score, isn't measured yet.",
        tableName: "Plan")
  }
}

/// A block's one number: the range large, its scale small beside it ("54–61 of 100"). A headline
/// never claims more than its parts, so its ends round outward.
struct PointsReadout: View {
  let range: WritingRange
  let max: Double
  var decimals: Int?

  var body: some View {
    HStack(alignment: .lastTextBaseline, spacing: 6) {
      Text(verbatim: WritingLabels.range(range, decimals: decimals, headline: true))
        .typeStyle(.momentReadout)
        .monospacedDigit()
      Text(
        "of \(WritingLabels.points(max))", tableName: "Essay",
        comment: "After a score: the question's total, like 'of 30'"
      )
      .typeStyle(.body)
      .foregroundStyle(.mutedForeground)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct ScoreRow<Detail: View>: View {
  let name: Text
  let range: WritingRange?
  let max: Double?
  var decimals: Int?
  /// Graded by level: no points to wait for, so no meter holds their place.
  var levels: Bool
  var minimum: Double?
  @ViewBuilder var detail: Detail

  init(
    name: Text, range: WritingRange?, max: Double?, decimals: Int? = nil, levels: Bool = false,
    minimum: Double? = nil, @ViewBuilder detail: () -> Detail = { EmptyView() }
  ) {
    self.name = name
    self.range = range
    self.max = max
    self.decimals = decimals
    self.levels = levels
    self.minimum = minimum
    self.detail = detail()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      LabeledContent {
        if let range, let max {
          Text(verbatim: WritingLabels.range(range, of: max, decimals: decimals))
            .typeStyle(.data)
        } else if levels {
          Text("Graded by level", tableName: "Plan")
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        } else {
          Text("Not measured yet", tableName: "Plan", comment: "A part with no graded answer yet")
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      } label: {
        name.typeStyle(.rowTitle)
      }

      if let max, !(levels && range == nil) {
        if let range {
          RangeBar(range: range, max: max, minimum: minimum)
        } else {
          UnmeasuredBar()
        }
      }

      detail
    }
    .accessibilityElement(children: .combine)
  }
}

/// Said against the part's own minimum, never the objective's: 50 of 100 on the sum of its answers.
private struct PartStanding: View {
  let part: WrittenPartPoints

  var body: some View {
    if let minimum = part.minimum?.value, let range = part.range {
      let points = WritingLabels.points(minimum)

      switch part.standing {
      case .met:
        Label {
          Text("Above the \(points) points needed", tableName: "Plan")
        } icon: {
          Image(systemName: "checkmark").foregroundStyle(.successText)
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      case .below:
        Label {
          Text(
            "\(WritingLabels.range(.init(high: minimum - range.low, low: minimum - range.high), decimals: part.decimals)) points short of the \(points) needed",
            tableName: "Plan")
        } icon: {
          Image(systemName: "xmark")
        }
        .typeStyle(.note)
        .foregroundStyle(.destructiveText)
      case .overlaps:
        Label {
          Text("Close to the \(points) points needed", tableName: "Plan")
        } icon: {
          Image(systemName: "exclamationmark.triangle")
        }
        .typeStyle(.note)
        .foregroundStyle(.warningText)
      case .unmeasured, nil:
        EmptyView()
      }
    }
  }
}

/// "Write": starts a written task the learner asked for and opens it, as one tap. `failed` says
/// the last tap didn't go through, for its screen to say where its notes go.
struct WriteNowButton: View {
  @Environment(ExamStore.self) private var store
  @Environment(AppRouter.self) private var router

  let goalId: String
  var taskKey: String?
  /// A task with a saved draft continues it.
  var continues = false
  @Binding var failed: Bool

  @State private var writing = VisitRequest<Bool>()

  var body: some View {
    BusyButton(isBusy: writing.isRunning) {
      failed = false
      writing.run {
        switch await store.writeNow(goalId: goalId, taskKey: taskKey) {
        case .done(let written):
          router.open(.essay(blockId: written.blockId, start: written.start))
          return true
        case .failed: return false
        case .obsolete: return nil
        }
      } then: { opened in
        failed = opened == false
      }
    } label: {
      if continues {
        Text("Continue", tableName: "Plan", comment: "Continues a written answer's saved draft")
      } else {
        Text("Write", tableName: "Plan", comment: "Starts a written answer")
      }
    }
    .buttonStyle(.mainAction)
    .onDisappear { writing.leave() }
  }
}

/// The score sheet's "Write", with its failure under it.
private struct WriteNowAction: View {
  let goalId: String
  @State private var failed = false

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      // As wide as the rows above it, as main's sheet draws it.
      WriteNowButton(goalId: goalId, failed: $failed)
        .controlSize(.large)
        .buttonSizing(.flexible)

      if failed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't go through. Try again in a moment.", table: "Plan",
            comment: "Starting a written answer failed"))
      }
    }
  }
}
