import SwiftUI

extension ActivityRenderer {
  static let sourceComparison = ActivityRenderer(
    template: "sourceComparison",
    grade: ActivityExpectedAnswer.grader(SourceComparisonFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: SourceComparisonFields.self) {
      SourceComparisonCanvas(fields: fields, context: context)
    }
  }
}

struct SourceComparisonFields: Decodable, Hashable, Sendable {
  struct Citation: Decodable, Hashable, Sendable {
    let title: String
    let publisher: String?
    let url: String?
    let year: Int?
  }

  struct Passage: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let isTarget: Bool
    let text: String
  }

  struct Source: Decodable, Hashable, Sendable, Identifiable {
    let author: String
    let citation: Citation
    let date: String
    let excerpt: String
    let id: String
    let passages: [Passage]
  }

  let markPrompt: String
  let sources: [Source]

  var expected: ActivityExpectedAnswer {
    .selection(sources.flatMap { $0.passages.filter(\.isTarget).map(\.id) })
  }
}

/// A piece of an excerpt: plain text, or a passage the learner can mark.
struct ExcerptSegment: Hashable {
  let passageId: String?
  let text: String

  /// Splits an excerpt into plain text and markable passages in reading order, as core's
  /// `splitExcerpt`: each passage at its first exact occurrence; a later overlapping one is skipped.
  static func split(_ excerpt: String, passages: [SourceComparisonFields.Passage])
    -> [ExcerptSegment]
  {
    let located =
      passages
      .compactMap { passage -> (id: String, range: Range<String.Index>)? in
        guard !passage.text.isEmpty, let range = excerpt.range(of: passage.text) else { return nil }
        return (passage.id, range)
      }
      .sorted { $0.range.lowerBound < $1.range.lowerBound }

    var ranges: [(id: String, range: Range<String.Index>)] = []

    for item in located
    where item.range.lowerBound >= (ranges.last?.range.upperBound ?? excerpt.startIndex) {
      ranges.append(item)
    }

    var segments: [ExcerptSegment] = []
    var cursor = excerpt.startIndex

    for item in ranges {
      if cursor < item.range.lowerBound {
        segments.append(
          ExcerptSegment(passageId: nil, text: String(excerpt[cursor..<item.range.lowerBound])))
      }

      segments.append(ExcerptSegment(passageId: item.id, text: String(excerpt[item.range])))
      cursor = item.range.upperBound
    }

    if cursor < excerpt.endIndex {
      segments.append(ExcerptSegment(passageId: nil, text: String(excerpt[cursor...])))
    }

    return segments
  }
}

/// Two eyewitness sources, to see how who wrote a source shapes what it says. The learner marks
/// passages in each by tapping them in the text (VoiceOver marks them from the excerpt's actions);
/// with a selection check the marked passages are the answer and the check shows which ones the
/// question was about.
private struct SourceComparisonCanvas: View {
  private enum PassageState {
    case unmarked, marked, correct, incorrect, missed
  }

  private static let passageScheme = "zoonk-passage"

  let fields: SourceComparisonFields
  let context: ActivityCanvasContext

  @State private var marked: [String]

  init(fields: SourceComparisonFields, context: ActivityCanvasContext) {
    self.fields = fields
    self.context = context
    _marked = State(initialValue: context.answer?.ids ?? [])
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      LessonRichText(fields.markPrompt)
        .font(.subheadline.weight(.medium))

      ForEach(Array(fields.sources.enumerated()), id: \.element.id) { index, source in
        sourceCard(source, symbol: index.isMultiple(of: 2) ? "scroll" : "book")
      }

      if isChecked {
        HStack(spacing: 16) {
          Label {
            Text(
              "What to mark", tableName: "Activities",
              comment: "Legend: the passages the question was about")
          } icon: {
            RoundedRectangle(cornerRadius: 2).fill(Color.success.opacity(0.3)).frame(
              width: 16, height: 10)
          }
          Label {
            Text(
              "Missed", tableName: "Activities",
              comment: "Legend: a passage the learner should have marked")
          } icon: {
            Rectangle().fill(Color.success).frame(width: 16, height: 2)
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)
      }
    }
    .environment(
      \.openURL,
      OpenURLAction { url in
        guard url.scheme == Self.passageScheme else {
          return .systemAction
        }

        toggle(url.lastPathComponent)
        return .handled
      })
  }

  private func sourceCard(_ source: SourceComparisonFields.Source, symbol: String) -> some View {
    let citation = [
      source.citation.title, source.citation.publisher, source.citation.year.map(String.init),
    ]
    .compactMap(\.self)
    .joined(separator: ", ")

    return VStack(alignment: .leading, spacing: 10) {
      Label {
        VStack(alignment: .leading, spacing: 0) {
          Text(source.author)
            .font(.subheadline.weight(.semibold))
          Text(source.date)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      } icon: {
        Image(systemName: symbol)
          .foregroundStyle(.mint)
      }
      .accessibilityElement(children: .combine)

      Text(excerpt(source))
        .lineSpacing(6)
        .accessibilityLabel(Text(verbatim: source.excerpt))
        .accessibilityValue(markedValue(source))
        .accessibilityActions {
          if !isChecked {
            ForEach(source.passages) { passage in
              Button {
                toggle(passage.id)
              } label: {
                if marked.contains(passage.id) {
                  Text(
                    "Unmark: \(passage.text)", tableName: "Activities",
                    comment: "VoiceOver action that unmarks a passage of a source")
                } else {
                  Text(
                    "Mark: \(passage.text)", tableName: "Activities",
                    comment: "VoiceOver action that marks a passage of a source")
                }
              }
            }
          }
        }

      if let url = source.citation.url.flatMap(URL.init(string:)) {
        Link(citation, destination: url)
          .font(.caption)
          .underline()
      } else {
        Text(citation)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))
  }

  private func excerpt(_ source: SourceComparisonFields.Source) -> AttributedString {
    ExcerptSegment.split(source.excerpt, passages: source.passages).reduce(into: AttributedString())
    {
      text, segment in
      var part = AttributedString(segment.text)

      if let id = segment.passageId, let passage = source.passages.first(where: { $0.id == id }) {
        if !isChecked {
          var link = URLComponents()
          link.scheme = Self.passageScheme
          link.path = "/\(id)"
          part.link = link.url
        }

        part.swiftUI.foregroundColor = Color.primary

        switch state(of: passage) {
        case .unmarked:
          part.swiftUI.underlineStyle = Text.LineStyle(pattern: .dot, color: .mint)
        case .marked:
          part.swiftUI.backgroundColor = Color.orange.opacity(0.25)
        case .correct:
          part.swiftUI.backgroundColor = Color.success.opacity(0.2)
        case .incorrect:
          part.swiftUI.backgroundColor = Color.destructive.opacity(0.2)
        case .missed:
          part.swiftUI.underlineStyle = Text.LineStyle(pattern: .dash, color: .success)
        }
      }

      text += part
    }
  }

  private func state(of passage: SourceComparisonFields.Passage) -> PassageState {
    let isMarked = marked.contains(passage.id)

    guard isChecked else {
      return isMarked ? .marked : .unmarked
    }

    if passage.isTarget {
      return isMarked ? .correct : .missed
    }

    return isMarked ? .incorrect : .unmarked
  }

  private func markedValue(_ source: SourceComparisonFields.Source) -> Text {
    let texts = source.passages.filter { marked.contains($0.id) }.map(\.text)

    return texts.isEmpty
      ? Text(
        "Nothing marked yet.", tableName: "Activities",
        comment: "VoiceOver: no passage of a source is marked")
      : Text(
        "You marked: \(texts.joined(separator: "; ")).", tableName: "Activities",
        comment: "VoiceOver: the passages of a source the learner marked")
  }

  private func toggle(_ id: String) {
    guard !isChecked, fields.sources.contains(where: { $0.passages.contains { $0.id == id } })
    else {
      return
    }

    if marked.contains(id) {
      marked.removeAll { $0 == id }
    } else {
      marked.append(id)
    }

    if case .interaction = context.check {
      context.setAnswer(marked.isEmpty ? nil : .selection(marked))
    }
  }
}
