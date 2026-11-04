import SwiftUI

struct EssayGradeSections: View {
  let grade: EssayGrade
  var isClosed = false

  var body: some View {
    if grade.zeroReason == .tooShort {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text("Too short to grade", tableName: "Essay", comment: "An essay too short to grade")
            .typeStyle(.body.weight(.semibold))
          if !isClosed {
            Text(
              "Write the whole essay, then send it again.", tableName: "Essay",
              comment: "What to do with an essay too short to grade"
            )
            .foregroundStyle(.mutedForeground)
          }
        }
      }
    } else {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text(MockLabels.range(low: grade.range.low, high: grade.range.high))
            .typeStyle(.momentReadout)
          Text(
            "Estimated score, from 0 to \(MockLabels.number(grade.total.maxScore))",
            tableName: "Essay", comment: "Under an essay's estimated range"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
        .accessibilityElement(children: .combine)

        ForEach(grade.criteria) { criterion in
          LabeledContent {
            Text(
              "\(MockLabels.number(criterion.score)) of \(MockLabels.number(criterion.maxScore))",
              tableName: "Essay", comment: "A criterion's score"
            )
            .monospacedDigit()
          } label: {
            Text(criterion.name)
              .typeWeight(criterion.id == grade.nextStep?.criterionId ? .semibold : .regular)
          }
        }
      } header: {
        SectionTitle(
          Text("Score by criterion", tableName: "Essay", comment: "Each criterion's score"))
      }

      Section {
        if let next = grade.nextStep {
          VStack(alignment: .leading, spacing: 4) {
            if let criterion = grade.nextStepCriterion {
              Text(criterion.name).typeStyle(.body.weight(.semibold))
            }
            Text(next.text)
          }
        } else {
          VStack(alignment: .leading, spacing: 4) {
            Text("Nothing left to work on", tableName: "Essay", comment: "Full marks")
              .typeStyle(.body.weight(.semibold))
            Text(
              "Every criterion has full marks in this estimate.", tableName: "Essay",
              comment: "Full marks on every criterion"
            )
            .foregroundStyle(.mutedForeground)
          }
        }
      } header: {
        SectionTitle(
          Text("Next step", tableName: "Essay", comment: "The one thing to work on next"))
      }

      if let elements = grade.enemInterventionElements {
        Section {
          ForEach(elements.named, id: \.name) { element in
            Label {
              Text(element.name)
            } icon: {
              Image(systemName: element.present ? "checkmark.circle.fill" : "circle.dashed")
                .foregroundStyle(element.present ? .success : .mutedForeground)
            }
            .accessibilityValue(
              element.present
                ? Text("present", tableName: "Essay", comment: "A proposal element is there")
                : Text("missing", tableName: "Essay", comment: "A proposal element is missing"))
          }
        } header: {
          SectionTitle(
            Text(
              "The five elements of the proposal", tableName: "Essay",
              comment: "ENEM's intervention proposal elements"))
        }
      }
    }
  }
}

struct EssayCommentsSection: View {
  let grade: EssayGrade
  @Binding var openCriteria: Set<String>

  var body: some View {
    if grade.zeroReason != .tooShort {
      Section {
        ForEach(grade.criteria) { criterion in
          DisclosureGroup(isExpanded: $openCriteria.contains(criterion.id)) {
            VStack(alignment: .leading, spacing: 8) {
              if let quote = criterion.quote {
                Text(verbatim: "“\(quote)”")
                  .italic()
                  .foregroundStyle(.mutedForeground)
              }
              Text(criterion.comment)
              if let example = criterion.example {
                Text("For example: \(example)", tableName: "Essay", comment: "A rewrite example")
                  .foregroundStyle(.mutedForeground)
              }
            }
            .typeStyle(.reading)
          } label: {
            Text(criterion.name)
          }
        }
      } header: {
        SectionTitle(Text("Comments", tableName: "Essay", comment: "Comments on each criterion"))
      }
    }
  }
}
