import SwiftUI

extension ActivityRenderer {
  static let labeledDiagram = ActivityRenderer(
    template: "labeledDiagram",
    grade: ActivityExpectedAnswer.grader(LabeledDiagramFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: LabeledDiagramFields.self) {
      LabeledDiagramCanvas(fields: fields, context: context)
    }
  }
}

struct LabeledDiagramFields: Decodable, Hashable, Sendable {
  struct Part: Decodable, Hashable, Sendable {
    let label: String
    /// What the part's number marks, in English, for the drawing.
    let part: String
  }

  struct MixUp: Decodable, Hashable, Sendable {
    let feedback: String
    let labels: [String]
  }

  let distractors: [String]
  let mixUps: [MixUp]
  /// In the picture's numbered order: the first part is spot 1.
  let parts: [Part]

  /// Spot keys ("1", "2", ...) with the name each takes, as core's answer key.
  var slots: [(key: String, label: String)] {
    parts.enumerated().map { (String($0.offset + 1), $0.element.label) }
  }

  var expected: ActivityExpectedAnswer {
    .assignment(
      Dictionary(slots.map { ($0.key, $0.label) }, uniquingKeysWith: { first, _ in first }))
  }

  func mixUpFeedback(correct: String, placed: String?) -> String? {
    guard let placed, placed != correct else {
      return nil
    }

    return mixUps.first { $0.labels.contains(placed) && $0.labels.contains(correct) }?.feedback
  }
}

private struct LabeledDiagramCanvas: View {
  let fields: LabeledDiagramFields
  let context: ActivityCanvasContext

  @State private var placements: [String: String]
  @State private var activeKey: String?
  @State private var targetedKey: String?
  @ScaledMetric(relativeTo: .subheadline) private var nameWidth = 110.0

  init(fields: LabeledDiagramFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context

    let placements = context.answer?.pairs ?? [:]
    _placements = State(initialValue: placements)
    _activeKey = State(
      initialValue: Self.nextEmpty(after: nil, placements: placements, fields: fields))
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var names: [String] {
    SeededShuffle.shuffled(
      fields.parts.map(\.label) + fields.distractors,
      seed: fields.parts.map(\.part).joined(separator: ","))
  }

  var body: some View {
    if case .explore = context.phase {
      key
    } else {
      board
    }
  }

  private var board: some View {
    let unplaced = names.filter { !placements.values.contains($0) }
    let activeNumber = isChecked ? nil : activeKey

    return VStack(alignment: .leading, spacing: 16) {
      if !isChecked {
        VStack(alignment: .leading, spacing: 8) {
          ActivityCaption(
            activeNumber.map {
              Text(
                "Tap a name for spot \($0), or drag it onto any spot.", tableName: "Activities",
                comment: "Above the names to put on a picture's numbered spots")
            }
              ?? Text(
                "Every spot has a name. Tap a spot to change it.", tableName: "Activities",
                comment: "Every numbered spot of a picture has a name"))

          LazyVGrid(
            columns: [GridItem(.adaptive(minimum: nameWidth), spacing: 8, alignment: .top)],
            alignment: .leading, spacing: 8
          ) {
            ForEach(unplaced, id: \.self) { name in
              nameTile(name, activeNumber: activeNumber)
            }
          }
        }
      }

      VStack(spacing: 8) {
        ForEach(fields.slots, id: \.key) { slot in
          slotRow(slot)
        }
      }
    }
  }

  private func nameTile(_ name: String, activeNumber: String?) -> some View {
    Button {
      if let activeNumber {
        place(name, on: activeNumber)
      }
    } label: {
      Text(name)
    }
    .buttonStyle(ActivityTileStyle(mark: .plain))
    .draggable(name)
    .accessibilityLabel(
      activeNumber.map {
        Text(
          "Put \(name) on spot \($0)", tableName: "Activities",
          comment: "VoiceOver: puts a name on the open numbered spot of a picture")
      } ?? Text(verbatim: name)
    )
    .accessibilityActions {
      ForEach(fields.slots, id: \.key) { slot in
        Button {
          place(name, on: slot.key)
        } label: {
          Text(
            "Put on spot \(slot.key)", tableName: "Activities",
            comment: "VoiceOver action that puts a name on a numbered spot")
        }
      }
    }
  }

  private func slotRow(_ slot: (key: String, label: String)) -> some View {
    let placed = placements[slot.key]
    let isActive = !isChecked && activeKey == slot.key
    let mark: ActivityTileMark =
      isChecked ? (placed == slot.label ? .right : .wrong) : isActive ? .selected : .plain

    return Button {
      select(slot.key)
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        Text(slot.key)
          .font(.subheadline.weight(.semibold).monospacedDigit())
          .frame(minWidth: 24)

        VStack(alignment: .leading, spacing: 2) {
          if isChecked {
            Text(placed ?? "—")
              .strikethrough(mark == .wrong)
            if mark == .wrong {
              Text(slot.label)
                .fontWeight(.semibold)
                .foregroundStyle(Color.primary)
              if let feedback = fields.mixUpFeedback(correct: slot.label, placed: placed) {
                LessonRichText(feedback)
                  .foregroundStyle(Color.secondary)
              }
            }
          } else if let placed {
            Text(placed)
              .fontWeight(.medium)
          } else {
            Group {
              if isActive {
                Text(
                  "Pick a name", tableName: "Activities",
                  comment: "The numbered spot waiting for a name")
              } else {
                Text(verbatim: "")
              }
            }
            .foregroundStyle(.secondary)
          }
        }
      }
    }
    .buttonStyle(ActivityTileStyle(mark: mark))
    .disabled(isChecked)
    .overlay {
      if targetedKey == slot.key {
        RoundedRectangle(cornerRadius: 12).strokeBorder(.primary, lineWidth: 2)
      }
    }
    .dropDestination(for: String.self) { items, _ in
      guard !isChecked, let name = items.first, names.contains(name) else {
        return false
      }

      place(name, on: slot.key)
      return true
    } isTargeted: { isTargeted in
      targetedKey = isTargeted ? slot.key : (targetedKey == slot.key ? nil : targetedKey)
    }
    .accessibilityLabel(slotLabel(slot, placed: placed, mark: mark))
    .accessibilityAddTraits(isActive ? .isSelected : [])
  }

  private func slotLabel(
    _ slot: (key: String, label: String), placed: String?, mark: ActivityTileMark
  )
    -> Text
  {
    if isChecked {
      return mark == .right
        ? Text(
          "Spot \(slot.key): \(slot.label), right", tableName: "Activities",
          comment: "VoiceOver after the check: a spot the learner named right")
        : Text(
          "Spot \(slot.key): your answer \(placed ?? ""), correct answer \(slot.label)",
          tableName: "Activities",
          comment: "VoiceOver after the check: a spot the learner named wrong")
    }

    return placed.map {
      Text(
        "Spot \(slot.key): \($0)", tableName: "Activities",
        comment: "VoiceOver: a numbered spot and its name")
    }
      ?? Text(
        "Spot \(slot.key): empty", tableName: "Activities",
        comment: "VoiceOver: a numbered spot with no name")
  }

  private func select(_ key: String) {
    guard let name = placements[key] else {
      activeKey = key
      return
    }

    placements[key] = nil
    activeKey = key
    context.setAnswer(answer(placements))
    announceActivityChange(
      String(
        localized: "\(name) taken off.", table: "Activities",
        comment: "VoiceOver, after a name is taken off a spot"))
  }

  private func place(_ name: String, on key: String) {
    guard !isChecked else {
      return
    }

    // A name already on another spot moves; the one it replaces goes back to the bank.
    var next = placements.filter { $0.key != key && $0.value != name }
    next[key] = name
    placements = next
    activeKey = Self.nextEmpty(after: key, placements: next, fields: fields)
    context.setAnswer(answer(next))
    announceActivityChange(
      String(
        localized: "\(name) on spot \(key).", table: "Activities",
        comment: "VoiceOver, after a name is put on a spot"))
  }

  private func answer(_ placements: [String: String]) -> ActivityAnswer? {
    fields.slots.allSatisfy { placements[$0.key] != nil } ? .assignment(placements) : nil
  }

  private static func nextEmpty(
    after: String?, placements: [String: String], fields: LabeledDiagramFields
  )
    -> String?
  {
    let keys = fields.slots.map(\.key)
    let start = after.flatMap { keys.firstIndex(of: $0) }.map { $0 + 1 } ?? 0
    let rotated = Array(keys[start...] + keys[..<start])
    return rotated.first { placements[$0] == nil }
  }

  private var key: some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(fields.slots, id: \.key) { slot in
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          Text(slot.key)
            .font(.subheadline.weight(.semibold).monospacedDigit())
            .frame(minWidth: 24)
          Text(slot.label)
        }
        .accessibilityElement(children: .combine)
      }
    }
  }
}
