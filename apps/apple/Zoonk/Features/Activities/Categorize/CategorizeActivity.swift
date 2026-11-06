import SwiftUI

extension ActivityRenderer {
  static let categorize = ActivityRenderer(
    template: "categorize", badge: .always(.sortGroups),
    grade: ActivityExpectedAnswer.grader(CategorizeFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: CategorizeFields.self) {
      CategorizeCanvas(fields: fields, context: context)
    }
  }
}

private struct CategorizeCanvas: View {
  private enum Focus: Hashable {
    case undo, status
    case group(String)
    case card(String)
  }

  let fields: CategorizeFields
  let context: ActivityCanvasContext
  private let items: [CategorizeFields.Item]

  @ActivityState private var sorting: CategorizeSorting
  @FocusState private var focus: Focus?
  @AccessibilityFocusState private var voiceOverFocus: Focus?
  @State private var targetedGroupId: String?

  init(fields: CategorizeFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context
    items = fields.shuffledItems
    _sorting = ActivityState(
      wrappedValue: CategorizeSorting(placements: context.answer?.pairs ?? [:]), "sorting")
  }

  private var expectedPairs: [String: String]? {
    guard case .checked = context.phase, case .assignment(let pairs) = fields.expected else {
      return nil
    }

    return pairs
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if let expectedPairs {
        ForEach(fields.groups) { group in
          sortedGroup(group) { item in
            checkedRow(item, isRight: expectedPairs[item.id] == group.id)
          }
        }

        results(expected: expectedPairs)
      } else if let card = sorting.cardInHand(from: items) {
        dealing(card)
      } else {
        Text(
          "All sorted. Choose a card to move it.", tableName: "Activities",
          comment: "Every card of a sorting activity has a group; choosing a card moves it"
        )
        .font(.subheadline.weight(.medium))
        .focusable()
        .focused($focus, equals: .status)
        .accessibilityFocused($voiceOverFocus, equals: .status)

        ForEach(fields.groups) { group in
          sortedGroup(group) { item in
            movableRow(item, from: group)
          }
        }
      }
    }
  }

  private func dealing(_ card: CategorizeFields.Item) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      ActivityCaption(
        Text(
          "\(items.count - CategorizePlacements.unplaced(items, sorting.placements).count) of \(items.count) sorted",
          tableName: "Activities",
          comment: "Progress while sorting: how many of the cards already have a group.")
      )
      .padding(.bottom, 8)

      dealtCard(card)

      ViewThatFits(in: .horizontal) {
        HStack(alignment: .firstTextBaseline) {
          question
          Spacer(minLength: 8)
          undoButton
        }

        VStack(alignment: .leading, spacing: 0) {
          question
            .padding(.top, 8)
          undoButton
        }
      }

      VStack(spacing: 10) {
        ForEach(Array(fields.groups.enumerated()), id: \.element.id) { index, group in
          groupButton(group, index: index, card: card)
        }
      }
    }
  }

  /// Every card is stacked in the box, so it is as tall as the tallest one and the groups under it
  /// never move while dealing.
  private func dealtCard(_ card: CategorizeFields.Item) -> some View {
    HStack(spacing: 12) {
      Image(systemName: "line.3.horizontal")
        .font(.body)
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)

      ZStack(alignment: .leading) {
        ForEach(items) { item in
          LessonRichText(item.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .opacity(item.id == card.id ? 1 : 0)
            .accessibilityHidden(item.id != card.id)
        }
      }
      .font(.title3.weight(.medium))
    }
    .multilineTextAlignment(.leading)
    .padding()
    .background(Color(.systemBackground), in: .rect(cornerRadius: 16))
    .overlay {
      RoundedRectangle(cornerRadius: 16)
        .strokeBorder(.separator)
    }
    .draggable(ActivityDragItem(id: card.id))
  }

  private var question: some View {
    Text(
      "Which group does it belong in?", tableName: "Activities",
      comment: "Under the card to sort, above the groups it can go in"
    )
    .font(.footnote)
    .foregroundStyle(.secondary)
  }

  /// Always laid out, so it appearing after the first card moves nothing.
  private var undoButton: some View {
    let canUndo = !sorting.history.isEmpty

    return Button(action: undo) {
      Label {
        Text(
          "Undo", tableName: "Activities",
          comment: "Takes back the last card sorted")
      } icon: {
        Image(systemName: "arrow.uturn.backward")
      }
      .frame(minHeight: 44)
      .contentShape(.rect)
    }
    .buttonStyle(.borderless)
    .font(.subheadline)
    .opacity(canUndo ? 1 : 0)
    .disabled(!canUndo)
    .accessibilityHidden(!canUndo)
    .focused($focus, equals: .undo)
    .accessibilityFocused($voiceOverFocus, equals: .undo)
  }

  /// One button, the preview inside it included, so nothing in it can take its tap.
  private func groupButton(_ group: CategorizeFields.Group, index: Int, card: CategorizeFields.Item)
    -> some View
  {
    Button {
      sort(card, into: group)
    } label: {
      VStack(alignment: .leading, spacing: 4) {
        LessonRichText(group.label)
        LessonRichText(group.rule)
          .font(.subheadline)
          .foregroundStyle(.secondary)
        preview(group)
      }
    }
    .buttonStyle(LessonOptionStyle(mark: targetedGroupId == group.id ? .selected : .plain))
    .modifier(ActivityNumberKey(index: index))
    .dropDestination(for: ActivityDragItem.self) { dropped, _ in
      // A number key may have sorted the dragged card already; never sort the next one.
      guard let inHand = sorting.cardInHand(from: items), dropped.first?.id == inHand.id else {
        return false
      }

      sort(inHand, into: group)
      return true
    } isTargeted: { isTargeted in
      if isTargeted {
        targetedGroupId = group.id
      } else if targetedGroupId == group.id {
        targetedGroupId = nil
      }
    }
    .focused($focus, equals: .group(group.id))
    .accessibilityFocused($voiceOverFocus, equals: .group(group.id))
    // Named by what it shows, so Voice Control's "Tap <label>" finds it.
    .accessibilityLabel(Text(verbatim: LessonRichText.spoken(group.label)))
    .accessibilityHint(Text(verbatim: LessonRichText.spoken(group.rule)))
  }

  /// A plain chip sizes the row before the group's first card, and math in a card (raised or
  /// lowered text) can't make it taller, so no group shifts the ones under it.
  private func preview(_ group: CategorizeFields.Group) -> some View {
    let sorted = sorting.history.filter { sorting.placements[$0] == group.id }
    let latest = items.first { $0.id == sorted.last }

    return Text(verbatim: " ")
      .previewChip()
      .frame(maxWidth: .infinity, alignment: .leading)
      .hidden()
      .overlay(alignment: .leading) {
        if let latest {
          HStack(spacing: 6) {
            LessonRichText(latest.text)
              .lineLimit(1)
              .previewChip()

            if sorted.count > 1 {
              Text(
                "+\(sorted.count - 1)", tableName: "Activities",
                comment: "On a group: how many more cards are in it besides the one shown"
              )
              .monospacedDigit()
              .foregroundStyle(.secondary)
              .previewChip()
              .fixedSize()
            }
          }
        }
      }
      .font(.footnote)
      .padding(.top, 4)
      .accessibilityHidden(true)
  }

  private func sortedGroup<Row: View>(
    _ group: CategorizeFields.Group, @ViewBuilder row: @escaping (CategorizeFields.Item) -> Row
  ) -> some View {
    let inGroup = items.filter { sorting.placements[$0.id] == group.id }

    return VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        LessonRichText(group.label)
          .font(.body.weight(.medium))
          .accessibilityAddTraits(.isHeader)
        LessonRichText(group.rule)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      if inGroup.isEmpty {
        Text(
          "No cards here", tableName: "Activities",
          comment: "A group of a sorting activity that no card was sorted into"
        )
        .font(.footnote)
        .foregroundStyle(.secondary)
      } else {
        VStack(spacing: 0) {
          ForEach(inGroup) { item in
            if item.id != inGroup.first?.id {
              Divider()
            }

            row(item)
          }
        }
        .background(Color(.systemBackground))
        .clipShape(.rect(cornerRadius: 12))
        .overlay {
          RoundedRectangle(cornerRadius: 12)
            .strokeBorder(.separator)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))
  }

  private func movableRow(_ item: CategorizeFields.Item, from group: CategorizeFields.Group)
    -> some View
  {
    Menu {
      Section {
        ForEach(fields.groups.filter { $0.id != group.id }) { other in
          Button {
            move(item, to: other)
          } label: {
            Text(LessonRichText.typeset(other.label))
          }
        }
      } header: {
        Text(
          "Move to", tableName: "Activities",
          comment: "Title of the menu that moves a sorted card into another group")
      }
    } label: {
      row(item) {
        Image(systemName: "chevron.up.chevron.down")
          .font(.footnote)
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
      }
    }
    .buttonStyle(.plain)
    .focused($focus, equals: .card(item.id))
    .accessibilityFocused($voiceOverFocus, equals: .card(item.id))
  }

  private func checkedRow(_ item: CategorizeFields.Item, isRight: Bool) -> some View {
    let mark: ActivityTileMark = isRight ? .right : .wrong
    let color: Color = isRight ? .success : .destructive

    return row(item) {
      if let symbol = mark.symbol {
        Image(systemName: symbol)
          .fontWeight(.semibold)
          .accessibilityHidden(true)
      }
    }
    .foregroundStyle(color)
    .background(color.opacity(0.15))
    .accessibilityElement(children: .combine)
    .accessibilityValue(mark.verdict ?? Text(verbatim: ""))
  }

  private func row<Trailing: View>(
    _ item: CategorizeFields.Item, @ViewBuilder trailing: () -> Trailing
  ) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      LessonRichText(item.text)
        .frame(maxWidth: .infinity, alignment: .leading)
      trailing()
    }
    .font(.subheadline)
    .multilineTextAlignment(.leading)
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .frame(minHeight: 44)
    .contentShape(.rect)
  }

  private func sort(_ card: CategorizeFields.Item, into group: CategorizeFields.Group) {
    sorting.sort(card.id, into: group.id)
    context.setAnswer(CategorizePlacements.answer(items, sorting.placements))

    let item = LessonRichText.spoken(card.text)
    let label = LessonRichText.spoken(group.label)

    if let next = sorting.cardInHand(from: items) {
      announcePolitely(
        String(
          localized: "\(item) is in \(label). Next: \(LessonRichText.spoken(next.text)).",
          table: "Activities", comment: "VoiceOver, after a card is sorted, with the next card"))
    } else {
      announcePolitely(
        String(
          localized: "\(item) is in \(label).", table: "Activities",
          comment: "VoiceOver, after the last card is sorted or a card is moved"))

      // The group or Undo that had focus is gone.
      if focus != nil {
        focus = .status
      }

      if voiceOverFocus != nil {
        voiceOverFocus = .status
      }
    }
  }

  private func undo() {
    guard let itemId = sorting.undo(), let item = items.first(where: { $0.id == itemId }) else {
      return
    }

    announcePolitely(
      String(
        localized: "Took back \(LessonRichText.spoken(item.text)).", table: "Activities",
        comment: "VoiceOver, after Undo puts the last card sorted back in hand"))

    if sorting.history.isEmpty, let first = fields.groups.first {
      if focus == .undo {
        focus = .group(first.id)
      }

      if voiceOverFocus == .undo {
        voiceOverFocus = .group(first.id)
      }
    }
  }

  private func move(_ item: CategorizeFields.Item, to group: CategorizeFields.Group) {
    sorting.move(item.id, to: group.id)
    context.setAnswer(CategorizePlacements.answer(items, sorting.placements))
    announcePolitely(
      String(
        localized:
          "\(LessonRichText.spoken(item.text)) is in \(LessonRichText.spoken(group.label)).",
        table: "Activities",
        comment: "VoiceOver, after the last card is sorted or a card is moved"))

    // The row is drawn anew in its new group, so focus follows it there.
    if focus != nil {
      focus = .card(item.id)
    }

    voiceOverFocus = .card(item.id)
  }

  private func results(expected: [String: String]) -> some View {
    let misplaced = CategorizePlacements.misplaced(
      items, expected: expected, placements: sorting.placements)

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

extension View {
  fileprivate func previewChip() -> some View {
    padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(Color(.systemBackground), in: .rect(cornerRadius: 6))
      .overlay {
        RoundedRectangle(cornerRadius: 6)
          .strokeBorder(.separator)
      }
  }
}
