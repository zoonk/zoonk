import SwiftUI

extension ActivityRenderer {
  static let combinationGrid = ActivityRenderer(
    template: "combinationGrid",
    grade: ActivityExpectedAnswer.grader(CombinationGridFields.self) {
      .grid(CombinationGrid.cells($0))
    }
  ) { context in
    if let fields = try? context.fields(as: CombinationGridFields.self) {
      CombinationGridCanvas(fields: fields, context: context)
    }
  }
}

private struct CombinationGridCanvas: View {
  let fields: CombinationGridFields
  let context: ActivityCanvasContext

  @State private var fill: [String?]
  @State private var activeCell: Int?
  @ScaledMetric(relativeTo: .body) private var cellSize = 56.0
  @ScaledMetric(relativeTo: .body) private var optionWidth = 72.0

  init(fields: CombinationGridFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context

    let right = CombinationGrid.cells(fields)
    let isReadOnly = context.phase == .explore || !CombinationGrid.isFillable(fields)
    let answered = context.answer?.cells.flatMap { $0.count == right.count ? $0 : nil }
    let fill: [String?] = isReadOnly ? right : answered ?? Array(repeating: nil, count: right.count)
    _fill = State(initialValue: fill)
    _activeCell = State(initialValue: CombinationGrid.nextEmpty(fill, after: nil))
  }

  private var right: [String] { CombinationGrid.cells(fields) }
  private var isReadOnly: Bool { context.phase == .explore || !CombinationGrid.isFillable(fields) }
  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }
  private var isLocked: Bool { isChecked || isReadOnly }
  private var output: String? { CombinationGrid.output(fields, check: context.check) }

  /// Cells the check's question counts, marked once checked (none for a filled-in grid, which is
  /// graded cell by cell).
  private var counted: Set<Int> {
    guard isChecked, let output, !isInteraction else {
      return []
    }

    return Set(right.indices.filter { CombinationGrid.cellMatches(right[$0], output: output) })
  }

  private var isInteraction: Bool {
    if case .interaction = context.check { true } else { false }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(fields.title)
        .font(.headline)

      board

      if let caption {
        ActivityCaption(caption)
      }

      if !isLocked {
        palette
      }
    }
  }

  private var board: some View {
    let columns = fields.columns.values

    return VStack(alignment: .leading, spacing: 4) {
      Text(fields.columns.label)
        .font(.caption)
        .foregroundStyle(.secondary)

      Grid(horizontalSpacing: 6, verticalSpacing: 6) {
        GridRow {
          Text(fields.rows.label)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .minimumScaleFactor(0.7)
            .frame(maxWidth: .infinity)
          ForEach(Array(columns.enumerated()), id: \.offset) { _, value in
            header(value)
          }
        }

        ForEach(Array(fields.rows.values.enumerated()), id: \.offset) { rowIndex, rowValue in
          GridRow {
            header(rowValue)
            ForEach(columns.indices, id: \.self) { columnIndex in
              cell(
                rowIndex * columns.count + columnIndex, row: rowValue, column: columns[columnIndex])
            }
          }
        }
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(description)
  }

  private func header(_ value: String) -> some View {
    Text(value)
      .font(.headline.monospacedDigit())
      .lineLimit(1)
      .minimumScaleFactor(0.5)
      .frame(maxWidth: .infinity, minHeight: cellSize * 0.6)
      .accessibilityHidden(true)
  }

  private func cell(_ index: Int, row: String, column: String) -> some View {
    let value = isChecked && isReadOnly ? nil : fill[index]
    let isActive = !isLocked && activeCell == index
    let mark: ActivityTileMark =
      if isChecked, !isReadOnly, let value {
        CombinationGrid.same(value, right[index]) ? .right : .wrong
      } else if counted.contains(index) {
        .right
      } else {
        isActive ? .selected : .plain
      }

    return Button {
      activeCell = index
    } label: {
      VStack(spacing: 2) {
        Text(value ?? (isChecked && isReadOnly ? right[index] : " "))
          .lineLimit(1)
          .minimumScaleFactor(0.5)
          .font(.body.weight(.semibold).monospacedDigit())
        if isChecked, !isReadOnly, mark == .wrong {
          Text(right[index])
            .font(.caption.monospacedDigit())
            .foregroundStyle(.primary)
        } else if let traits = fields.traits, let shown = value ?? (isReadOnly ? right[index] : nil)
        {
          Text(CombinationGrid.isDominant(shown) ? traits.dominant : traits.recessive)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
      }
      .frame(maxWidth: .infinity, minHeight: cellSize)
    }
    .buttonStyle(ActivityTileStyle(mark: mark, isCompact: true))
    .disabled(isLocked)
    .accessibilityLabel(
      value.map {
        Text(
          "Square \(index + 1), \(row) and \(column): \($0)", tableName: "Activities",
          comment: "VoiceOver: a filled square of a grid, its row and column values, then its value"
        )
      }
        ?? Text(
          "Square \(index + 1), \(row) and \(column): empty", tableName: "Activities",
          comment: "VoiceOver: an empty square of a grid, with its row and column values")
    )
    .accessibilityValue(mark.verdict ?? Text(verbatim: ""))
    .accessibilityAddTraits(isActive ? .isSelected : [])
  }

  private var description: Text {
    let rows = fields.rows.values.joined(separator: ", ")
    let columns = fields.columns.values.joined(separator: ", ")

    switch fields.rule {
    case "alleles":
      return Text(
        "A Punnett square for \(fields.title): \(fields.rows.label) (\(fields.rows.values.joined())) down the side, \(fields.columns.label) (\(fields.columns.values.joined())) across the top.",
        tableName: "Activities", comment: "VoiceOver: what a Punnett square shows")
    case "sum":
      return Text(
        "\(fields.title): \(fields.rows.label) (\(rows)) down the side, \(fields.columns.label) (\(columns)) across the top, each square their sum.",
        tableName: "Activities", comment: "VoiceOver: what a grid of sums shows")
    default:
      return Text(
        "\(fields.title): \(fields.rows.label) (\(rows)) down the side, \(fields.columns.label) (\(columns)) across the top, each square their product.",
        tableName: "Activities", comment: "VoiceOver: what a grid of products shows")
    }
  }

  private var caption: Text? {
    let total = fill.count

    if isChecked, let output, !isInteraction {
      let what =
        fields.traits.map { traits in
          output == "dominant" ? traits.dominant : output == "recessive" ? traits.recessive : output
        } ?? output

      return Text(
        "\(counted.count) of \(total) squares: \(what)", tableName: "Activities",
        comment:
          "After the check: how many squares of a grid the question counts, and what it counts")
    }

    if isReadOnly {
      return nil
    }

    if isChecked {
      let rightCount = fill.indices.filter { index in
        fill[index].map { CombinationGrid.same($0, right[index]) } ?? false
      }.count
      return Text(
        "\(rightCount) of \(total) squares right", tableName: "Activities",
        comment: "After the check: how many squares of a grid the learner filled right")
    }

    guard let traits = fields.traits else {
      return Text(
        "\(fill.compactMap(\.self).count) of \(total) squares filled", tableName: "Activities",
        comment: "How many squares of a grid the learner filled")
    }

    let filled = fill.compactMap(\.self)
    let dominant = filled.filter(CombinationGrid.isDominant).count

    return Text(
      "\(traits.dominant): \(dominant) of \(total) · \(traits.recessive): \(filled.count - dominant) of \(total)",
      tableName: "Activities", comment: "The tally of each trait under a Punnett square")
  }

  private var palette: some View {
    VStack(alignment: .leading, spacing: 8) {
      Group {
        if let activeCell {
          if fields.isAllele {
            Text(
              "Which genotype goes in square \(activeCell + 1)?", tableName: "Activities",
              comment: "Above the genotypes to put in a Punnett square's square")
          } else {
            Text(
              "What goes in square \(activeCell + 1)?", tableName: "Activities",
              comment: "Above the values to put in a grid's square")
          }
        } else {
          Text(
            "Every square is filled. Tap one to change it.", tableName: "Activities",
            comment: "Every square of a grid has a value")
        }
      }
      .font(.subheadline.weight(.medium))

      if activeCell != nil {
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: optionWidth), spacing: 8)], alignment: .leading,
          spacing: 8
        ) {
          ForEach(Array(CombinationGrid.options(fields).enumerated()), id: \.element) {
            index, option in
            Button {
              pick(option)
            } label: {
              VStack(spacing: 2) {
                Text(option)
                  .font(.body.weight(.semibold).monospacedDigit())
                if let traits = fields.traits {
                  Text(CombinationGrid.isDominant(option) ? traits.dominant : traits.recessive)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
              }
              .frame(maxWidth: .infinity)
            }
            .buttonStyle(ActivityTileStyle(mark: .plain))
            .modifier(ActivityNumberKey(index: index))
          }
        }
      }
    }
  }

  private func pick(_ value: String) {
    guard let activeCell else {
      return
    }

    fill[activeCell] = value
    self.activeCell = CombinationGrid.nextEmpty(fill, after: activeCell)

    switch context.check {
    case .numeric:
      context.setAnswer(
        output.flatMap { CombinationGrid.share(fill, output: $0) }.map(ActivityAnswer.numeric))
    case .interaction:
      let cells = fill.compactMap(\.self)
      context.setAnswer(cells.count == fill.count ? .grid(cells) : nil)
    default:
      break
    }
  }
}
