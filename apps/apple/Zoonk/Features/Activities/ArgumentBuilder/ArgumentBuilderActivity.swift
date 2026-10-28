import SwiftUI

extension ActivityRenderer {
  static let argumentBuilder = ActivityRenderer(
    template: "argumentBuilder",
    grade: ActivityExpectedAnswer.grader(ArgumentFields.self) { .selection($0.strongIds) }
  ) { context in
    if let fields = try? context.fields(as: ArgumentFields.self) {
      ArgumentBuilderCanvas(fields: fields, context: context)
    }
  }
}

struct ArgumentFields: Decodable, Hashable, Sendable {
  struct Quote: Decodable, Hashable, Sendable, Identifiable {
    let citation: String
    let id: String
    let isStrong: Bool
    let quote: String
    let why: String
  }

  struct Reasoning: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let isStrong: Bool
    let text: String
    let why: String
  }

  let claim: String
  let evidence: [Quote]
  let reasoning: [Reasoning]

  var strongIds: [String] {
    evidence.filter(\.isStrong).map(\.id) + reasoning.filter(\.isStrong).map(\.id)
  }
}

private struct ArgumentBuilderCanvas: View {
  private enum Part: String {
    case evidence, reasoning
  }

  let fields: ArgumentFields
  let context: ActivityCanvasContext

  @State private var evidenceId: String?
  @State private var reasoningId: String?
  @State private var targetedPart: Part?

  init(fields: ArgumentFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context

    let ids = context.answer?.ids ?? []
    _evidenceId = State(initialValue: fields.evidence.first { ids.contains($0.id) }?.id)
    _reasoningId = State(initialValue: fields.reasoning.first { ids.contains($0.id) }?.id)
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var openPart: Part? {
    if evidenceId == nil {
      return .evidence
    }

    return reasoningId == nil ? .reasoning : nil
  }

  var body: some View {
    let quote = fields.evidence.first { $0.id == evidenceId }
    let reasoning = fields.reasoning.first { $0.id == reasoningId }

    VStack(alignment: .leading, spacing: 16) {
      VStack(alignment: .leading, spacing: 8) {
        VStack(alignment: .leading, spacing: 2) {
          Text("Claim", tableName: "Activities", comment: "The claim an argument is built for")
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
          LessonRichText(fields.claim)
            .fontWeight(.medium)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.mint.opacity(0.15), in: .rect(cornerRadius: 12))
        .accessibilityElement(children: .combine)

        slot(
          .evidence,
          label: Text(
            "Evidence", tableName: "Activities",
            comment: "The part of an argument that quotes a source"),
          hint: Text(
            "Pick the quote that best supports the claim", tableName: "Activities",
            comment: "An argument's empty evidence part"),
          isStrong: quote?.isStrong, why: quote?.why
        ) {
          quote.map { AnyView(QuoteText(text: $0.quote, citation: $0.citation)) }
        }

        slot(
          .reasoning,
          label: Text(
            "Reasoning", tableName: "Activities",
            comment: "The part of an argument that explains the quote"),
          hint: openPart == .reasoning
            ? Text(
              "Pick how the quote proves the claim", tableName: "Activities",
              comment: "An argument's empty reasoning part, open for a pick")
            : Text(
              "Next: explain how the quote proves the claim", tableName: "Activities",
              comment: "An argument's empty reasoning part, waiting for the evidence first"),
          isStrong: reasoning?.isStrong, why: reasoning?.why
        ) {
          reasoning.map { AnyView(LessonRichText($0.text)) }
        }
      }

      if !isChecked {
        switch openPart {
        case .evidence:
          candidates(
            title: Text(
              "Quotes", tableName: "Activities", comment: "Above the quotes to pick as evidence"),
            items: SeededShuffle.shuffled(fields.evidence, seed: "evidence \(fields.claim)").map {
              ($0.id, AnyView(QuoteText(text: $0.quote, citation: $0.citation)), $0.quote)
            }, part: .evidence)
        case .reasoning:
          candidates(
            title: Text(
              "Reasoning", tableName: "Activities", comment: "Above the reasoning lines to pick"),
            items: SeededShuffle.shuffled(fields.reasoning, seed: "reasoning \(fields.claim)").map {
              ($0.id, AnyView(LessonRichText($0.text)), $0.text)
            }, part: .reasoning)
        case nil:
          ActivityCaption(
            Text(
              "Your argument is ready. Check it, or take a part out to change it.",
              tableName: "Activities", comment: "Both parts of an argument are picked"))
        }
      } else {
        review(quote: quote, reasoning: reasoning)
      }
    }
  }

  private func slot(
    _ part: Part, label: Text, hint: Text, isStrong: Bool?, why: String?,
    content: () -> AnyView?
  ) -> some View {
    let filled = content()
    let isOpen = !isChecked && openPart == part
    let verdict: ActivityTileMark = isChecked ? (isStrong == true ? .right : .wrong) : .plain

    return VStack(alignment: .leading, spacing: 6) {
      HStack {
        label
          .font(.caption.weight(.semibold))
          .foregroundStyle(isOpen || filled != nil ? .primary : .secondary)

        Spacer()

        if isChecked {
          Label {
            if isStrong == true {
              Text(
                "Strong", tableName: "Activities",
                comment: "After the check: a strong pick in an argument")
            } else {
              Text(
                "Weak", tableName: "Activities",
                comment: "After the check: a weak pick in an argument")
            }
          } icon: {
            Image(systemName: verdict.symbol ?? "")
          }
          .font(.caption.weight(.semibold))
          .foregroundStyle(isStrong == true ? Color.success : Color.destructive)
        } else if filled != nil {
          Button {
            take(part)
          } label: {
            Label {
              if part == .evidence {
                Text(
                  "Take the quote out", tableName: "Activities",
                  comment: "Empties an argument's evidence part")
              } else {
                Text(
                  "Take the reasoning out", tableName: "Activities",
                  comment: "Empties an argument's reasoning part")
              }
            } icon: {
              Image(systemName: "xmark.circle.fill")
            }
            .labelStyle(.iconOnly)
          }
          .buttonStyle(.borderless)
          .foregroundStyle(.secondary)
        }
      }

      if let filled {
        filled
        if isChecked, let why {
          LessonRichText(why)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
      } else {
        hint
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
    .background(slotFill(verdict: verdict, isFilled: filled != nil), in: .rect(cornerRadius: 12))
    .overlay {
      RoundedRectangle(cornerRadius: 12)
        .strokeBorder(
          slotStroke(verdict: verdict, isOpen: isOpen, isTargeted: targetedPart == part),
          style: StrokeStyle(lineWidth: 2, dash: filled == nil ? [5, 4] : []))
    }
    .accessibilityElement(children: .contain)
    .dropDestination(for: String.self) { ids, _ in
      guard isOpen, let id = ids.first else {
        return false
      }

      return pick(id, for: part)
    } isTargeted: { isTargeted in
      targetedPart = isTargeted ? part : (targetedPart == part ? nil : targetedPart)
    }
  }

  private func slotFill(verdict: ActivityTileMark, isFilled: Bool) -> Color {
    switch verdict {
    case .right: Color.success.opacity(0.1)
    case .wrong: Color.destructive.opacity(0.1)
    default: isFilled ? Color(.systemBackground) : .clear
    }
  }

  private func slotStroke(verdict: ActivityTileMark, isOpen: Bool, isTargeted: Bool) -> Color {
    switch verdict {
    case .right: .success
    case .wrong: .destructive
    default: isTargeted ? .primary : isOpen ? .primary.opacity(0.5) : Color(.separator)
    }
  }

  private func candidates(title: Text, items: [(String, AnyView, String)], part: Part) -> some View
  {
    VStack(alignment: .leading, spacing: 8) {
      title
        .font(.subheadline.weight(.medium))

      ForEach(items, id: \.0) { id, content, text in
        Button {
          _ = pick(id, for: part)
        } label: {
          content
        }
        .buttonStyle(ActivityTileStyle(mark: .plain))
        .draggable(id)
        .accessibilityLabel(
          part == .evidence
            ? Text(
              "Use as evidence: \(LessonRichText.plain(text))", tableName: "Activities",
              comment: "VoiceOver: puts a quote in an argument's evidence part")
            : Text(
              "Use as reasoning: \(LessonRichText.plain(text))", tableName: "Activities",
              comment: "VoiceOver: puts a line in an argument's reasoning part"))
      }
    }
  }

  private func pick(_ id: String, for part: Part) -> Bool {
    guard !isChecked else {
      return false
    }

    switch part {
    case .evidence:
      guard fields.evidence.contains(where: { $0.id == id }) else { return false }
      evidenceId = id
    case .reasoning:
      guard fields.reasoning.contains(where: { $0.id == id }) else { return false }
      reasoningId = id
    }

    report()
    return true
  }

  private func take(_ part: Part) {
    switch part {
    case .evidence: evidenceId = nil
    case .reasoning: reasoningId = nil
    }

    report()
  }

  private func report() {
    if let evidenceId, let reasoningId {
      context.setAnswer(.selection([evidenceId, reasoningId]))
    } else {
      context.setAnswer(nil)
    }
  }

  @ViewBuilder
  private func review(quote: ArgumentFields.Quote?, reasoning: ArgumentFields.Reasoning?)
    -> some View
  {
    if let strong = fields.evidence.first(where: \.isStrong), strong.id != quote?.id {
      reviewCard(
        title: Text(
          "Stronger evidence", tableName: "Activities", comment: "After the check: the strong quote"
        ),
        content: AnyView(QuoteText(text: strong.quote, citation: strong.citation)), why: strong.why)
    }

    if let strong = fields.reasoning.first(where: \.isStrong), strong.id != reasoning?.id {
      reviewCard(
        title: Text(
          "Stronger reasoning", tableName: "Activities",
          comment: "After the check: the strong reasoning"),
        content: AnyView(LessonRichText(strong.text)), why: strong.why)
    }
  }

  private func reviewCard(title: Text, content: AnyView, why: String) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      title
        .font(.caption.weight(.semibold))
        .foregroundStyle(Color.success)
      content
      LessonRichText(why)
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
    .accessibilityElement(children: .combine)
  }
}

private struct QuoteText: View {
  let text: String
  let citation: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(LessonRichText.attributed("“\(text)”"))
      Text(citation)
        .font(.caption)
        .foregroundStyle(.secondary)
    }
  }
}
