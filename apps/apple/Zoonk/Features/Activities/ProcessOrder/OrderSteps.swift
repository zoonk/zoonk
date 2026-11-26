import SwiftUI

struct OrderSteps<ID: Hashable & LosslessStringConvertible>: View {
  let order: [ID]
  @Binding var selectedId: ID?
  let text: (ID) -> String?
  var icon: (ID) -> String? = { _ in nil }
  let onReorder: ([ID]) -> Void

  @State private var targetedId: ID?

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(Array(order.enumerated()), id: \.element) { index, id in
        if let label = text(id) {
          row(id, label: label, index: index)
            .modifier(PickKey(index: index))
            .practiceFocus(index == 0 ? .answer : nil)
        }
      }

      ActivityCaption(
        Text(
          "Drag the steps into order, or tap one and then its place.", tableName: "Activities",
          comment: "Under the steps of a process to put in order"))
    }
  }

  private func row(_ id: ID, label: String, index: Int) -> some View {
    let isSelected = selectedId == id

    return Button {
      if let selectedId, selectedId != id {
        move(selectedId, to: index)
      } else {
        selectedId = isSelected ? nil : id
      }
    } label: {
      ProcessStepRow(position: index + 1, icon: icon(id), mark: .plain, isDraggable: true) {
        LessonRichText(label)
          .typeWeight(.medium)
      }
    }
    .buttonStyle(ActivityTileStyle(mark: isSelected ? .selected : .plain))
    .overlay {
      if targetedId == id {
        RoundedRectangle(cornerRadius: Radius.option).fill(.selectedTint)
      }
    }
    .draggable(ActivityDragItem(id: id.description))
    .dropDestination(for: ActivityDragItem.self) { dropped, _ in
      guard let rawId = dropped.first?.id, let id = ID(rawId), order.contains(id) else {
        return false
      }

      move(id, to: index)
      return true
    } isTargeted: { isTargeted in
      if isTargeted {
        targetedId = id
      } else if targetedId == id {
        targetedId = nil
      }
    }
    .accessibilityLabel(
      Text(
        "\(index + 1). \(LessonRichText.spoken(label))", tableName: "Activities",
        comment: "VoiceOver: a step's place in the learner's order, then the step")
    )
    .accessibilityAddTraits(isSelected ? .isSelected : [])
    .accessibilityActions {
      if index > 0 {
        Button {
          move(id, to: index - 1)
        } label: {
          Text("Move up", tableName: "Activities", comment: "VoiceOver action on a step to order")
        }
      }

      if index < order.count - 1 {
        Button {
          move(id, to: index + 1)
        } label: {
          Text("Move down", tableName: "Activities", comment: "VoiceOver action on a step to order")
        }
      }
    }
  }

  private func move(_ id: ID, to index: Int) {
    guard let from = order.firstIndex(of: id), from != index else {
      selectedId = nil
      return
    }

    var moved = order
    moved.remove(at: from)
    moved.insert(id, at: index)
    selectedId = nil
    onReorder(moved)

    let label = text(id).map { LessonRichText.spoken($0) } ?? ""
    announcePolitely(
      String(
        localized: "\(label) is now step \(index + 1).", table: "Activities",
        locale: .appLanguage, comment: "VoiceOver, after a step of a process moves"))
  }
}

struct ProcessStepRow<Content: View>: View {
  let position: Int
  let icon: String?
  let mark: ActivityTileMark
  var isDraggable = false
  @ViewBuilder let content: Content

  var body: some View {
    MarkedRow(stackedSpacing: 8) {
      ProcessStepMarks(position: position, icon: icon, mark: mark)
    } content: {
      content
    } end: {
      if isDraggable {
        Image(systemName: "line.3.horizontal")
          .foregroundStyle(.mutedForeground)
          .accessibilityHidden(true)
      }
    }
  }
}

private struct ProcessStepMarks: View {
  let position: Int
  let icon: String?
  let mark: ActivityTileMark

  @ScaledMetric(relativeTo: .subheadline) private var badge = 28.0

  var body: some View {
    HStack(spacing: 10) {
      Text(position, format: .number)
        .typeStyle(.note.weight(.semibold).monospaced())
        .foregroundStyle(mark == .plain ? Color.primary : Color(.background))
        .frame(width: badge, height: badge)
        .background(fill, in: .circle)

      if let symbol = ProcessIcons.symbol(for: icon) {
        // In one square box, as Lucide draws every icon, so a wide one (a battery) isn't wider.
        Image(systemName: symbol)
          .resizable()
          .scaledToFit()
          .foregroundStyle(.mutedForeground)
          .frame(width: badge * 0.7, height: badge * 0.7)
          .frame(width: badge)
      }
    }
    .accessibilityHidden(true)
  }

  private var fill: Color {
    switch mark {
    case .right: .success
    case .wrong: .destructive
    default: Color.muted
    }
  }
}
