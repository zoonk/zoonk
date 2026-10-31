import SwiftUI

struct PatternTableFields: Decodable, Hashable, Sendable {
  struct Row: Decodable, Hashable, Sendable {
    let label: String
    let labelMeaning: String?
    let model: String
    let answer: String
    let blank: Bool
  }

  let choices: [String]
  let modelWord: String
  let modelMeaning: String?
  let newWord: String
  let newMeaning: String?
  let rows: [Row]

  var blanks: [Int] { rows.indices.filter { rows[$0].blank } }

  /// Core's `patternEnding`: the longest offered ending the answer ends with.
  func ending(of answer: String) -> String? {
    choices.filter { answer.hasSuffix($0) }.max { $0.count < $1.count }
  }

  /// Each blank's ending by its row index, the interaction core expects.
  var expected: [String: String] {
    Dictionary(uniqueKeysWithValues: blanks.map { (String($0), ending(of: rows[$0].answer) ?? "") })
  }

  func stem(_ row: Row) -> String {
    String(row.answer.dropLast(ending(of: row.answer)?.count ?? 0))
  }

  static func commonStem(_ words: [String]) -> String {
    guard let first = words.first else {
      return ""
    }

    let characters = Array(first)
    let length =
      characters.indices.first { index in
        words.dropFirst().contains { word in
          let other = Array(word)
          return index >= other.count || other[index] != characters[index]
        }
      } ?? characters.count

    return String(characters.prefix(length))
  }

  func nextOpenBlank(after current: Int?, filled: [String: String]) -> Int? {
    let start = current.flatMap { blanks.firstIndex(of: $0).map { $0 + 1 } } ?? 0
    let ordered =
      Array(blanks[min(start, blanks.count)...]) + Array(blanks[..<min(start, blanks.count)])
    return ordered.first { filled[String($0)] == nil }
  }

  /// Core's assignment grading: every blank holds its ending.
  func grade(_ answer: ActivityAnswer) -> Bool {
    guard let assignment = try? answer.decode(as: PatternTableAnswer.self),
      assignment.kind == "assignment"
    else {
      return false
    }

    return assignment.pairs.count == expected.count
      && expected.allSatisfy { assignment.pairs[$0.key] == $0.value }
  }
}

struct PatternTableAnswer: Codable, Hashable, Sendable {
  var kind = "assignment"
  let pairs: [String: String]
}

struct PatternTableCanvas: View {
  let context: ActivityCanvasContext
  let fields: PatternTableFields

  @State private var filled: [String: String]
  @State private var active: Int?

  init(context: ActivityCanvasContext, fields: PatternTableFields) {
    self.context = context
    self.fields = fields

    let filled =
      (context.answer.flatMap { try? $0.decode(as: PatternTableAnswer.self) })?.pairs ?? [:]
    _filled = State(initialValue: filled)
    _active = State(initialValue: fields.nextOpenBlank(after: nil, filled: filled))
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  var body: some View {
    let modelStem = PatternTableFields.commonStem(fields.rows.map(\.model))
    let newStem = PatternTableFields.commonStem(fields.rows.map(\.answer))

    ChartsCanvas {
      Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 10) {
        GridRow {
          Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
          header(fields.modelWord, meaning: fields.modelMeaning)
          header(fields.newWord, meaning: fields.newMeaning)
        }

        Divider().gridCellUnsizedAxes(.horizontal)

        ForEach(Array(fields.rows.enumerated()), id: \.offset) { index, row in
          GridRow(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 0) {
              Text(verbatim: row.label).font(.subheadline.weight(.medium))
              if let meaning = row.labelMeaning {
                Text(verbatim: meaning).font(.caption).foregroundStyle(.secondary)
              }
            }

            form(row.model, stem: modelStem)

            if !row.blank {
              form(row.answer, stem: newStem)
            } else if isChecked {
              checkedBlank(index, row: row)
            } else {
              openBlank(index, row: row)
            }
          }
        }
      }

      if !isChecked, let active, fields.rows.indices.contains(active) {
        let row = fields.rows[active]

        Text(
          "Which ending does \(row.label) take?", tableName: "ActivitiesCharts",
          comment: "Above a pattern table's endings, like Which ending does nosotros take?"
        )
        .font(.subheadline.weight(.medium))

        LazyVGrid(columns: [GridItem(.adaptive(minimum: 88), spacing: 8)], spacing: 8) {
          ForEach(fields.choices, id: \.self) { choice in
            Button {
              choose(choice)
            } label: {
              Text(verbatim: "-\(choice)")
            }
            .buttonStyle(
              ChartsChoiceStyle(state: filled[String(active)] == choice ? .selected : .plain)
            )
            .accessibilityAddTraits(filled[String(active)] == choice ? .isSelected : [])
          }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
          Text(
            "Endings for \(row.label)", tableName: "ActivitiesCharts",
            comment: "The group of endings to pick from"))
      }
    }
  }

  private func header(_ word: String, meaning: String?) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(verbatim: word).font(.headline)
      if let meaning {
        Text(verbatim: meaning).font(.caption).foregroundStyle(.secondary)
      }
    }
  }

  private func form(_ word: String, stem: String) -> some View {
    let parts =
      !stem.isEmpty && word.hasPrefix(stem) && word.count > stem.count
      ? (stem, String(word.dropFirst(stem.count))) : (word, "")

    return Text(
      "\(Text(verbatim: parts.0))\(Text(verbatim: parts.1).foregroundStyle(.mint).bold())"
    )
    .font(.body)
  }

  private func openBlank(_ index: Int, row: PatternTableFields.Row) -> some View {
    let chosen = filled[String(index)]
    let isActive = active == index
    let stem = fields.stem(row)

    return Button {
      active = index
    } label: {
      HStack(spacing: 1) {
        Text(verbatim: stem)
        if let chosen {
          Text(verbatim: chosen).foregroundStyle(.mint).bold()
        } else {
          RoundedRectangle(cornerRadius: 2)
            .fill(isActive ? Color.mint.opacity(0.25) : .clear)
            .overlay(alignment: .bottom) {
              Rectangle().fill(isActive ? Color.mint : Color.secondary).frame(height: 2)
            }
            .frame(width: 36, height: 20)
        }
      }
      .frame(minHeight: 44)
      .padding(.horizontal, 8)
      .overlay {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
          .strokeBorder(isActive ? Color.mint : .clear, lineWidth: 2)
      }
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(
      Text(
        "\(row.label): \(stem + (chosen ?? "…")), choose the ending", tableName: "ActivitiesCharts",
        comment: "A blank in a pattern table, for VoiceOver")
    )
    .accessibilityAddTraits(isActive ? .isSelected : [])
  }

  private func checkedBlank(_ index: Int, row: PatternTableFields.Row) -> some View {
    let chosen = filled[String(index)]
    let expected = fields.expected[String(index)]
    let stem = fields.stem(row)
    let isRight = chosen != nil && chosen == expected

    return VStack(alignment: .leading, spacing: 2) {
      Text(verbatim: stem + (chosen ?? "…"))
        .foregroundStyle(isRight ? Color.success : .destructive)
        .strikethrough(!isRight && chosen != nil)

      if !isRight, let expected {
        Text(verbatim: stem + expected)
          .foregroundStyle(.success)
          .accessibilityLabel(
            Text(
              "Correct answer: \(stem + expected)", tableName: "ActivitiesCharts",
              comment: "The right form after a miss, for VoiceOver"))
      }
    }
    .fontWeight(.medium)
  }

  private func choose(_ ending: String) {
    guard let current = active else {
      return
    }

    var next = filled
    next[String(current)] = ending
    filled = next
    active = fields.nextOpenBlank(after: current, filled: next) ?? current

    let isComplete = fields.blanks.allSatisfy { next[String($0)] != nil }
    context.setAnswer(
      isComplete ? try? ActivityAnswer(encoding: PatternTableAnswer(pairs: next)) : nil)
  }
}
