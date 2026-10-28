import SwiftUI

extension ActivityRenderer {
  static let categorize = ActivityRenderer(
    template: "categorize",
    grade: ActivityExpectedAnswer.grader(CategorizeFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: CategorizeFields.self) {
      CategorizeCanvas(fields: fields, context: context)
    }
  }
}

/// Sort examples into groups to find the rule that separates them. Tap an item, then its group,
/// or drag it there; VoiceOver puts it in a group from its actions. Every item needs a group
/// before the check. Afterwards each item shows whether its group is right, and the misplaced ones
/// say where they belong and why.
private struct CategorizeCanvas: View {
  let fields: CategorizeFields
  let context: ActivityCanvasContext

  @State private var placements: [String: String]
  @State private var selectedId: String?
  @State private var targetedGroupId: String?
  @FocusState private var focusedItemId: String?
  @AccessibilityFocusState private var voiceOverItemId: String?
  @ScaledMetric(relativeTo: .subheadline) private var tileWidth = 140.0
  @ScaledMetric(relativeTo: .subheadline) private var groupWidth = 150.0

  init(fields: CategorizeFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context
    _placements = State(initialValue: context.answer?.pairs ?? [:])
  }

  private var items: [CategorizeFields.Item] { fields.shuffledItems }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var expectedPairs: [String: String]? {
    guard isChecked, case .assignment(let pairs) = fields.expected else {
      return nil
    }

    return pairs
  }

  var body: some View {
    let waiting = CategorizePlacements.unplaced(items, placements)

    VStack(alignment: .leading, spacing: 16) {
      if !isChecked {
        VStack(alignment: .leading, spacing: 8) {
          HStack(alignment: .firstTextBaseline) {
            Group {
              if waiting.isEmpty {
                Text(
                  "All sorted. Check when you're ready.", tableName: "Activities",
                  comment: "Every item of a sorting activity has a group")
              } else {
                Text("To sort", tableName: "Activities", comment: "Above the items left to sort")
              }
            }
            .font(.subheadline.weight(.medium))

            Spacer(minLength: 8)

            ActivityCaption(
              Text(
                "\(items.count - waiting.count) of \(items.count) sorted", tableName: "Activities",
                comment: "How many items of a sorting activity have a group"))
          }

          if !waiting.isEmpty {
            LazyVGrid(
              columns: [GridItem(.adaptive(minimum: tileWidth), spacing: 8, alignment: .top)],
              alignment: .leading, spacing: 8
            ) {
              ForEach(waiting) { item in
                tile(item)
              }
            }
          }
        }
      }

      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: groupWidth), spacing: 10, alignment: .top)],
        alignment: .leading, spacing: 10
      ) {
        ForEach(fields.groups) { group in
          groupPanel(group)
        }
      }

      if let expectedPairs {
        results(expected: expectedPairs)
      }
    }
  }

  // MARK: - Items and groups

  private func tile(_ item: CategorizeFields.Item) -> some View {
    let mark = mark(for: item)

    return Button {
      selectedId = selectedId == item.id ? nil : item.id
    } label: {
      LessonRichText(item.text)
    }
    .buttonStyle(ActivityTileStyle(mark: mark))
    .disabled(isChecked)
    .focused($focusedItemId, equals: item.id)
    .accessibilityFocused($voiceOverItemId, equals: item.id)
    .draggable(item.id)
    .accessibilityAddTraits(selectedId == item.id ? .isSelected : [])
    .accessibilityValue(mark.verdict ?? Text(verbatim: ""))
    .accessibilityHint(
      isChecked
        ? Text(verbatim: "")
        : Text(
          "Pick it, then pick its group.", tableName: "Activities",
          comment: "VoiceOver hint on an item to sort")
    )
    .accessibilityActions {
      if !isChecked {
        ForEach(fields.groups) { group in
          Button {
            place(item.id, in: group.id)
          } label: {
            Text(
              "Put in \(LessonRichText.plain(group.label))", tableName: "Activities",
              comment: "VoiceOver action that sorts an item into a group")
          }
        }
      }
    }
  }

  private func groupPanel(_ group: CategorizeFields.Group) -> some View {
    let inGroup = items.filter { placements[$0.id] == group.id }
    let selected = isChecked ? nil : items.first { $0.id == selectedId }

    return ActivityDropPanel(isReady: selected != nil, isTargeted: targetedGroupId == group.id) {
      Button {
        if let selected {
          place(selected.id, in: group.id)
        }
      } label: {
        VStack(alignment: .leading, spacing: 2) {
          LessonRichText(group.label)
            .font(.headline)
          LessonRichText(group.rule)
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .accessibilityAddTraits(.isHeader)
      .accessibilityLabel(
        selected.map {
          Text(
            "Put \(LessonRichText.plain($0.text)) in \(LessonRichText.plain(group.label))",
            tableName: "Activities", comment: "VoiceOver: places the picked item in this group")
        } ?? Text(LessonRichText.attributed(group.label))
      )
      .accessibilityHint(
        selected == nil ? Text(LessonRichText.attributed(group.rule)) : Text(verbatim: ""))

      ForEach(inGroup) { item in
        tile(item)
      }

      if inGroup.isEmpty {
        Group {
          if selected != nil {
            Text(
              "Put it here", tableName: "Activities", comment: "An empty group, with an item picked"
            )
          } else {
            Text("Nothing here yet", tableName: "Activities", comment: "An empty group")
          }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, minHeight: 44)
        .overlay {
          RoundedRectangle(cornerRadius: 12)
            .strokeBorder(.separator, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        }
        .accessibilityHidden(true)
      }
    }
    .contentShape(.rect)
    .onTapGesture {
      if let selected {
        place(selected.id, in: group.id)
      }
    }
    .dropDestination(for: String.self) { ids, _ in
      guard let id = ids.first, items.contains(where: { $0.id == id }) else {
        return false
      }

      place(id, in: group.id)
      return true
    } isTargeted: { isTargeted in
      if isTargeted {
        targetedGroupId = group.id
      } else if targetedGroupId == group.id {
        targetedGroupId = nil
      }
    }
  }

  private func mark(for item: CategorizeFields.Item) -> ActivityTileMark {
    if let expectedPairs {
      return expectedPairs[item.id] == placements[item.id] ? .right : .wrong
    }

    return selectedId == item.id ? .selected : .plain
  }

  private func place(_ itemId: String, in groupId: String) {
    guard !isChecked, let item = items.first(where: { $0.id == itemId }),
      let group = fields.groups.first(where: { $0.id == groupId })
    else {
      return
    }

    placements[itemId] = groupId
    selectedId = nil
    context.setAnswer(CategorizePlacements.answer(items, placements))

    let sorted = items.count - CategorizePlacements.unplaced(items, placements).count
    announceActivityChange(
      String(
        localized:
          "\(LessonRichText.plain(item.text)) is in \(LessonRichText.plain(group.label)). \(sorted) of \(items.count) sorted.",
        table: "Activities", comment: "VoiceOver, after an item is sorted into a group"))

    // Keyboard and VoiceOver focus move on to the next item left, as on main.
    if let nextId = CategorizePlacements.nextUnplacedId(
      items, placedId: itemId, placements: placements)
    {
      if focusedItemId != nil {
        focusedItemId = nextId
      }

      if voiceOverItemId != nil {
        voiceOverItemId = nextId
      }
    }
  }

  // MARK: - After the check

  private func results(expected: [String: String]) -> some View {
    let misplaced = CategorizePlacements.misplaced(
      items, expected: expected, placements: placements)

    return VStack(alignment: .leading, spacing: 8) {
      Text(
        "\(items.count - misplaced.count) of \(items.count) in the right group",
        tableName: "Activities", comment: "After checking a sorting activity"
      )
      .font(.subheadline.weight(.semibold))
      .monospacedDigit()

      ActivityReasonList(
        reasons: misplaced.map { item in
          let group = fields.groups.first { $0.id == expected[item.id] }?.label ?? ""

          return ActivityReasonList.Reason(
            id: item.id,
            text: String(
              localized: "\(item.text) belongs in \(group).", table: "Activities",
              comment: "After the check: where a misplaced item goes"),
            why: item.why)
        })
    }
  }
}
