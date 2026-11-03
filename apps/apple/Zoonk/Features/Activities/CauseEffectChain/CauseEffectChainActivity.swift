import SwiftUI

extension ActivityRenderer {
  static let causeEffectChain = ActivityRenderer(
    template: "causeEffectChain", badge: .always(.linkCauses),
    grade: ActivityExpectedAnswer.grader(CauseEffectFields.self) { .links($0.expected) }
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

  enum LinkState {
    case made, correct, incorrect, missed
  }

  struct ShownLink: Hashable {
    let link: ActivityExpectedAnswer.Link
    let state: LinkState
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

  var expected: [ActivityExpectedAnswer.Link] {
    links.map { ActivityExpectedAnswer.Link(from: $0.from, to: $0.to) }
  }

  func label(_ id: String) -> String {
    nodes.first { $0.id == id }?.label ?? id
  }

  /// Nil shows the lesson's chain: while exploring, and on a checked screen whose answer doesn't
  /// hold the learner's links (a choice check, or one from an earlier sitting).
  static func learnerLinks(answer: ActivityAnswer?, phase: ActivityPhase)
    -> [ActivityExpectedAnswer.Link]?
  {
    if let links = answer?.links {
      return links
    }

    return phase == .answering ? [] : nil
  }

  /// The lesson's chain shows ungraded. A guided chain keeps only real links, so they show as right.
  func shownLinks(learnerLinks: [ActivityExpectedAnswer.Link]?, isChecked: Bool, isGuided: Bool)
    -> [ShownLink]
  {
    guard let learnerLinks else {
      return expected.map { ShownLink(link: $0, state: .made) }
    }

    if isChecked, !isGuided {
      return learnerLinks.map {
        ShownLink(link: $0, state: expected.contains($0) ? .correct : .incorrect)
      } + expected.filter { !learnerLinks.contains($0) }.map { ShownLink(link: $0, state: .missed) }
    }

    return learnerLinks.map { ShownLink(link: $0, state: isGuided ? .correct : .made) }
  }
}

private struct CauseEffectCanvas: View {
  private typealias Link = ActivityExpectedAnswer.Link

  let fields: CauseEffectFields
  let context: ActivityCanvasContext

  @ActivityState private var learnerLinks: [Link]?
  @ActivityState("causeId") private var causeId: String? = nil
  @ActivityState("notice") private var notice: String? = nil
  @State private var targetedId: String?

  init(fields: CauseEffectFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context
    _learnerLinks = ActivityState(
      wrappedValue: CauseEffectFields.learnerLinks(answer: context.answer, phase: context.phase),
      "learnerLinks")
  }

  private var links: [Link] { learnerLinks ?? [] }

  private var isExploring: Bool { context.phase == .explore }
  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  /// A choice check guides: only real links are kept, each confirmed with its why.
  private var isGuided: Bool {
    if case .choice = context.check { !isExploring } else { false }
  }

  private var isLocked: Bool { isChecked || isExploring }

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
    .draggable(ActivityDragItem(id: node.id))
    .dropDestination(for: ActivityDragItem.self) { dropped, _ in
      guard !isLocked, let from = dropped.first?.id, from != node.id,
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
              "Led to \(LessonRichText.spoken(effect.label))", tableName: "Activities",
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

    if isGuided, !fields.expected.contains(link) {
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
    var next = links

    if isRemoving {
      next.removeAll { $0 == link }
    } else if !next.contains(link) {
      next.append(link)
    }

    learnerLinks = next

    if case .interaction = context.check {
      context.setAnswer(next.isEmpty ? nil : .links(next))
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

  @ViewBuilder
  private var linkList: some View {
    let shown = fields.shownLinks(
      learnerLinks: learnerLinks, isChecked: isChecked, isGuided: isGuided)

    if !shown.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        ForEach(shown, id: \.link) { item in
          linkRow(item.link, state: item.state)
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        learnerLinks == nil
          ? Text(
            "How they connect", tableName: "Activities",
            comment: "Names the list of a cause-and-effect chain's links that the lesson drew")
          : Text(
            "Your links", tableName: "Activities",
            comment: "Names the list of the cause-and-effect links the learner made"))
    }
  }

  private func linkRow(_ link: Link, state: CauseEffectFields.LinkState) -> some View {
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
            "\(LessonRichText.spoken(fields.label(link.from))) led to \(LessonRichText.spoken(fields.label(link.to)))",
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
              "Remove the link from \(LessonRichText.spoken(fields.label(link.from))) to \(LessonRichText.spoken(fields.label(link.to)))",
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
