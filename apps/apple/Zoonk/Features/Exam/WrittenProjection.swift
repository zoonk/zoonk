import SwiftUI

/// A written part's points: its range against its own minimum, and each task's. Ranges are nil
/// until that task has an independent first draft with a numeric grade.
struct WrittenPartPoints: Hashable, Decodable, Sendable {
  enum Standing: String, UnknownAPIValue, Sendable {
    case unrecognized
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

  /// The minimum in the part's points, which its range is in: a share of the part becomes points.
  var minimumPoints: Double? {
    guard let minimum else { return nil }
    guard minimum.unit == .percent else { return minimum.value }
    return max.map { minimum.value / 100 * $0 }
  }
}

/// Whether a written part can be estimated in points yet, or its answers are graded by level. A
/// scale this version doesn't know reads as not said, so the part falls back on its range.
enum WritingScale: String, OmittableAPIContent, Sendable {
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

  /// A part graded by level has no points to wait for, and one with an estimate says on its own row
  /// whether it reaches its minimum, so the headline names only a part with no estimate yet.
  var headline: Headline? {
    if let below = parts.first(where: { $0.standing == .below }) {
      return .below(below)
    }

    if let unmeasured = parts.first(where: { $0.shownScale == .points && $0.range == nil }) {
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
        Text("Estimated score", tableName: "Plan")
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)

        switch projection.headline {
        case .below(let part):
          // A part's name comes from the notice, so it opens a sentence rather than sitting inside one.
          Text(
            "Likely below the minimum to pass", tableName: "Plan"
          )
          .typeStyle(.stepHeading)
          if let minimum = part.minimum {
            Group {
              if let points = part.minimumPoints {
                Text(
                  "\(part.name) needs \(WritingLabels.points(points)) points, whatever your other scores.",
                  tableName: "Plan")
              } else {
                Text(
                  "\(part.name) needs \(WritingLabels.share(minimum.value / 100)) of its points, whatever your other scores.",
                  tableName: "Plan")
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
        name: Text("Objective test", tableName: "Plan"),
        range: projection.objective, max: projection.objectiveMax)

      ForEach(projection.parts, id: \.name) { part in
        ScoreRow(
          name: Text(part.name), range: part.range, max: part.max, decimals: part.decimals,
          levels: part.shownScale == .levels,
          minimum: part.minimumPoints, written: true
        ) {
          if part.shownScale == .points, part.tasks.count > 1 {
            VStack(alignment: .leading, spacing: 4) {
              ForEach(part.tasks) { task in
                LabeledContent {
                  if let range = task.range, let max = task.max {
                    Text(verbatim: WritingLabels.range(range, of: max, decimals: part.decimals))
                      .typeStyle(.data)
                      .foregroundStyle(Color(.foreground))
                  } else {
                    Text("Not measured yet", tableName: "Plan")
                      .typeStyle(.note)
                      .foregroundStyle(.mutedForeground)
                  }
                } label: {
                  Text(WritingLabels.taskName(task.writingTask, title: task.name))
                    .typeStyle(.note)
                    .foregroundStyle(.mutedForeground)
                }
              }
            }
          }
          // The headline already says this part is likely below its minimum.
          if projection.headline != .below(part) {
            WrittenStandingLine(part: part)
              .typeStyle(.note)
          }
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
        "\(part.name) isn't measured yet.", tableName: "Plan")
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
        "of \(WritingLabels.partPoints(max))", tableName: "Essay"
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
  /// Graded by level: no points to wait for.
  var levels: Bool
  var minimum: Double?
  var written: Bool
  @ViewBuilder var detail: Detail

  init(
    name: Text, range: WritingRange?, max: Double?, decimals: Int? = nil, levels: Bool = false,
    minimum: Double? = nil, written: Bool = false,
    @ViewBuilder detail: () -> Detail = { EmptyView() }
  ) {
    self.name = name
    self.range = range
    self.max = max
    self.decimals = decimals
    self.levels = levels
    self.minimum = minimum
    self.written = written
    self.detail = detail()
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      LabeledContent {
        if let range, let max {
          Text(verbatim: WritingLabels.range(range, of: max, decimals: decimals, headline: written))
            .typeStyle(.data)
            .foregroundStyle(Color(.foreground))
        } else if levels {
          Text("Graded by level", tableName: "Plan")
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        } else {
          Text("Not measured yet", tableName: "Plan")
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      } label: {
        name.typeStyle(.rowTitle)
      }

      if let max {
        RangeBar(range: range, max: max, minimum: minimum)
      }

      detail
    }
    .accessibilityElement(children: .combine)
  }
}

/// A written part's estimate against its own minimum, as main's `WrittenStandingLine` says it.
/// Each verdict is "likely": it comes from how closely graders' marks match the board's, never a
/// promise, so it never says by how much; the estimate beside it shows the gap. Without one, an
/// estimate beside a minimum would read as a pass, so the line says it can't tell. Its type comes
/// from where it sits, so in a mock's "By test" it reads like the objective tests' lines beside it.
struct WrittenStandingLine: View {
  let part: WrittenPartPoints

  var body: some View {
    if let minimum = part.minimumPoints, part.range != nil {
      let points = WritingLabels.points(minimum)

      switch part.standing {
      case .met:
        line(
          Text("Likely above the \(points) points needed", tableName: "Plan"),
          mark: Image(systemName: "checkmark"),
          style: .mutedForeground)
      case .below:
        line(
          Text("Likely below the \(points) points needed", tableName: "Plan"),
          mark: Image(systemName: "xmark"), style: .destructiveText)
      case .overlaps:
        line(
          Text("Could be either side of the \(points) points needed", tableName: "Plan"),
          mark: Image(systemName: "exclamationmark.triangle"), style: .warningText)
      case .unmeasured:
        Text("Can't say yet whether this reaches the \(points) points needed", tableName: "Plan")
          .foregroundStyle(.mutedForeground)
      case .unrecognized, nil:
        EmptyView()
      }
    }
  }

  /// A `Label` inside a `LabeledContent`'s label splits into two lines of it, so the mark sits on
  /// the words' first baseline here instead.
  private func line(_ words: Text, mark: some View, style: some ShapeStyle) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 4) {
      mark.accessibilityHidden(true)
      words
    }
    .foregroundStyle(style)
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
        Text("Write", tableName: "Plan")
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
            "That didn't go through. Try again in a moment.", table: "Plan"))
      }
    }
  }
}
