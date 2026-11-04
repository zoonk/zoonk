import SwiftUI

struct LessonRecapView: View {
  let recap: LessonRecap
  @Binding var isExpanded: Bool

  var body: some View {
    DisclosureGroup(isExpanded: $isExpanded) {
      VStack(alignment: .leading, spacing: 12) {
        content
      }
      .font(.subheadline)
      .padding(.top, 8)
    } label: {
      Label {
        VStack(alignment: .leading, spacing: 4) {
          Text(
            "From the lesson", tableName: "Player",
            comment: "Heading of the row under a question that recaps the screen it comes after")

          if let title {
            LessonRichText(title)
              .font(.subheadline)
              .foregroundStyle(.mutedForeground)
          }
        }
      } icon: {
        Image(systemName: "text.quote")
      }
    }
  }

  private var title: String? {
    switch recap.step.content {
    case .explanation(let explanation): explanation.title
    case .workedExample(let example): example.title
    default: nil
    }
  }

  @ViewBuilder
  private var content: some View {
    switch recap.step.content {
    case .explanation(let explanation):
      LessonTextBlocks(explanation.text, mark: recap.mark)
      visual(explanation.visual)
    case .workedExample(let example):
      workedExample(example)
    default:
      EmptyView()
    }
  }

  @ViewBuilder
  private func workedExample(_ example: WorkedExampleContent) -> some View {
    LessonTextBlocks(example.problem, mark: recap.mark)

    ForEach(Array(example.steps.enumerated()), id: \.offset) { index, solved in
      HStack(alignment: .firstTextBaseline, spacing: 10) {
        Text(index + 1, format: .number)
          .monospacedDigit()
          .foregroundStyle(.mutedForeground)

        VStack(alignment: .leading, spacing: 4) {
          LessonTextBlocks(solved.text, mark: recap.mark)

          if let math = solved.math {
            Text(LessonMath.typeset(math))
          }
        }
      }
      .accessibilityElement(children: .combine)
    }

    VStack(alignment: .leading, spacing: 4) {
      Text("Result", tableName: "Player", comment: "Above a worked example's result in a recap")
        .fontWeight(.medium)
        .foregroundStyle(.mutedForeground)

      LessonTextBlocks(example.result, mark: recap.mark)
    }

    visual(example.visual)
  }

  @ViewBuilder
  private func visual(_ visual: LessonVisual?) -> some View {
    if let visual {
      LessonVisualView(visual: visual)
    }
  }
}
