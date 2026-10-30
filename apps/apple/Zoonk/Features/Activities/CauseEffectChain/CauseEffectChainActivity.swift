import SwiftUI

extension ActivityRenderer {
  static let causeEffectChain = ActivityRenderer(
    template: "causeEffectChain",
    grade: ActivityExpectedAnswer.grader(CauseEffectFields.self) {
      .links($0.links.map { ActivityExpectedAnswer.Link(from: $0.from, to: $0.to) })
    }
  ) { context in
    if let fields = try? context.fields(as: CauseEffectFields.self) {
      CauseEffectCanvas(fields: fields, context: context)
    }
  }
}

struct CauseEffectFields: Decodable, Hashable, Sendable {
  struct Link: Decodable, Hashable, Sendable {
    let from: String
    let to: String
    let why: String
  }

  struct Node: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let year: Int?
  }

  let links: [Link]
  let nodes: [Node]

  /// Top to bottom in time when every node has a date, so causes tend to sit above their effects
  /// without giving away which links exist; otherwise in the writer's order.
  var orderedNodes: [Node] {
    nodes.allSatisfy { $0.year != nil } ? nodes.sorted { ($0.year ?? 0) < ($1.year ?? 0) } : nodes
  }

  func label(_ id: String) -> String {
    nodes.first { $0.id == id }?.label ?? id
  }
}

private struct CauseEffectCanvas: View {
  private typealias Link = ActivityExpectedAnswer.Link

  private enum LinkState {
    case made, correct, incorrect, missed
  }

  let fields: CauseEffectFields
  let context: ActivityCanvasContext

  @State private var links: [Link]
  @State private var causeId: String?
  @State private var notice: String?
  @State private var targetedId: String?

  init(fields: CauseEffectFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context

    let isExploring = context.phase == .explore
    _links = State(
      initialValue: isExploring
        ? fields.links.map { Link(from: $0.from, to: $0.to) } : context.answer?.links ?? [])
  }

  private var isExploring: Bool { context.phase == .explore }
  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  /// A choice check guides: only real links are kept, each confirmed with its why.
  private var isGuided: Bool {
    if case .choice = context.check { !isExploring } else { false }
  }

  private var isLocked: Bool { isChecked || isExploring }
  private var expected: [Link] { fields.links.map { Link(from: $0.from, to: $0.to) } }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if !isLocked {
        HStack(alignment: .firstTextBaseline) {
          Group {
            if let causeId {
              Text(
                "Now pick what \(fields.label(causeId)) led to.", tableName: "Activities",
                comment: "A cause is picked; the learner picks its effect next")
            } else {
              Text(
                "Pick a cause, then pick what it led to.", tableName: "Activities",
                comment: "How to link causes and effects")
            }
          }
          .font(.subheadline.weight(.medium))

          Spacer(minLength: 8)

          if case .interaction = context.check {
            ActivityCaption(
              Text(
                "\(links.count) of \(fields.links.count) links", tableName: "Activities",
                comment: "How many cause-effect links the learner made, of how many there are"))
          }
        }
      }

      VStack(spacing: 8) {
        ForEach(fields.orderedNodes) { node in
          nodeCard(node)
        }
      }

      if !isLocked, let notice {
        Text(notice)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      linkList
    }
  }

  private func nodeCard(_ node: CauseEffectFields.Node) -> some View {
    let isCause = causeId == node.id
    let isCandidate = causeId != nil && !isCause

    return Button {
      press(node.id)
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        if let year = node.year {
          Text(year, format: .number.grouping(.never))
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
        }
        LessonRichText(node.label)
      }
    }
    .buttonStyle(ActivityTileStyle(mark: isCause ? .selected : .plain))
    .disabled(isLocked)
    .overlay {
      if isCandidate || targetedId == node.id {
        RoundedRectangle(cornerRadius: 12)
          .strokeBorder(
            .primary.opacity(targetedId == node.id ? 1 : 0.4),
            style: StrokeStyle(lineWidth: 2, dash: targetedId == node.id ? [] : [5, 4]))
      }
    }
    .draggable(node.id)
    .dropDestination(for: String.self) { ids, _ in
      guard !isLocked, let from = ids.first, from != node.id,
        fields.nodes.contains(where: { $0.id == from })
      else {
        return false
      }

      causeId = nil
      link(from: from, to: node.id)
      return true
    } isTargeted: { isTargeted in
      targetedId = isTargeted ? node.id : (targetedId == node.id ? nil : targetedId)
    }
    .accessibilityAddTraits(isCause ? .isSelected : [])
    .accessibilityHint(
      isCandidate
        ? Text(
          "Links it as what the picked cause led to.", tableName: "Activities",
          comment: "VoiceOver hint on an event while a cause is picked")
        : Text(verbatim: "")
    )
    .accessibilityActions {
      if !isLocked {
        ForEach(fields.orderedNodes.filter { $0.id != node.id }) { effect in
          Button {
            link(from: node.id, to: effect.id)
          } label: {
            Text(
              "Led to \(LessonRichText.plain(effect.label))", tableName: "Activities",
              comment: "VoiceOver action that links this cause to an effect")
          }
        }
      }
    }
  }

  private func press(_ id: String) {
    guard let cause = causeId else {
      causeId = id
      notice = String(
        localized: "\(fields.label(id)) picked. Now pick what it led to.", table: "Activities",
        comment: "A cause is picked")
      announceActivityChange(notice ?? "")
      return
    }

    causeId = nil

    if cause == id {
      notice = nil
    } else {
      link(from: cause, to: id)
    }
  }

  private func link(from: String, to: String) {
    let link = Link(from: from, to: to)
    let cause = LessonRichText.plain(fields.label(from))
    let effect = LessonRichText.plain(fields.label(to))

    if isGuided, !expected.contains(link) {
      notice = String(
        localized: "\(cause) didn't lead straight to \(effect) here. Try another link.",
        table: "Activities",
        comment:
          "A link the learner drew that isn't in the story; the arguments are the cause and the effect"
      )
      announceActivityChange(notice ?? "")
      return
    }

    let isRemoving = links.contains(link) && !isGuided

    if isRemoving {
      links.removeAll { $0 == link }
    } else if !links.contains(link) {
      links.append(link)
    }

    if case .interaction = context.check {
      context.setAnswer(links.isEmpty ? nil : .links(links))
    }

    notice =
      isRemoving
      ? String(
        localized: "Removed: \(cause) led to \(effect).", table: "Activities",
        comment: "A cause-effect link was taken out")
      : String(
        localized: "Linked: \(cause) led to \(effect).", table: "Activities",
        comment: "A cause-effect link was made")
    announceActivityChange(notice ?? "")
  }

  private var shownLinks: [(link: Link, state: LinkState)] {
    if isChecked, !isGuided {
      return links.map { ($0, expected.contains($0) ? .correct : .incorrect) }
        + expected.filter { !links.contains($0) }.map { ($0, .missed) }
    }

    return links.map { ($0, isGuided ? .correct : .made) }
  }

  @ViewBuilder
  private var linkList: some View {
    let shown = shownLinks

    if !shown.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        ForEach(shown, id: \.link) { item in
          linkRow(item.link, state: item.state)
        }
      }
    }
  }

  private func linkRow(_ link: Link, state: LinkState) -> some View {
    let why = fields.links.first { $0.from == link.from && $0.to == link.to }?.why
    let showsWhy = (isGuided || isLocked) && state != .incorrect

    return HStack(alignment: .firstTextBaseline, spacing: 8) {
      Group {
        switch state {
        case .correct: Image(systemName: "checkmark").foregroundStyle(Color.success)
        case .incorrect: Image(systemName: "xmark").foregroundStyle(Color.destructive)
        case .missed: Image(systemName: "circle.dashed").foregroundStyle(Color.success)
        case .made: Image(systemName: "arrow.right").foregroundStyle(.secondary)
        }
      }
      .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        Text(
          verbatim:
            "\(LessonRichText.plain(fields.label(link.from))) → \(LessonRichText.plain(fields.label(link.to)))"
        )
        .fontWeight(.medium)
        .accessibilityLabel(
          Text(
            "\(LessonRichText.plain(fields.label(link.from))) led to \(LessonRichText.plain(fields.label(link.to)))",
            tableName: "Activities", comment: "VoiceOver: one cause-effect link"))

        switch state {
        case .incorrect:
          Text(
            "Not a link in this story", tableName: "Activities",
            comment: "After the check: a wrong cause-effect link"
          )
          .foregroundStyle(.destructive)
        case .missed:
          Text(
            "Missed link", tableName: "Activities",
            comment: "After the check: a cause-effect link the learner missed"
          )
          .foregroundStyle(Color.success)
        default:
          EmptyView()
        }

        if showsWhy, let why {
          LessonRichText(why)
            .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      if !isLocked, !isGuided {
        Button {
          self.link(from: link.from, to: link.to)
        } label: {
          Label {
            Text(
              "Remove the link from \(LessonRichText.plain(fields.label(link.from))) to \(LessonRichText.plain(fields.label(link.to)))",
              tableName: "Activities", comment: "Takes out a cause-effect link")
          } icon: {
            Image(systemName: "xmark.circle.fill")
          }
          .labelStyle(.iconOnly)
        }
        .buttonStyle(.borderless)
        .foregroundStyle(.secondary)
      }
    }
    .font(.subheadline)
    .padding(12)
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
    .overlay {
      if state == .missed {
        RoundedRectangle(cornerRadius: 12)
          .strokeBorder(Color.success, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
      }
    }
    .accessibilityElement(children: .contain)
  }
}
