import SwiftUI

struct EssayGradeSections: View {
  let grade: EssayGrade

  var body: some View {
    if grade.zeroReason == .tooShort {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text("Too short to grade", tableName: "Essay", comment: "An essay too short to grade")
            .font(.headline)
          Text(
            "Write the whole essay, then send it again.", tableName: "Essay",
            comment: "What to do with an essay too short to grade"
          )
          .foregroundStyle(.secondary)
        }
      }
    } else {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text(MockLabels.range(low: grade.range.low, high: grade.range.high))
            .font(.largeTitle.weight(.semibold).monospacedDigit())
          Text(
            "Estimated score, from 0 to \(MockLabels.number(grade.total.maxScore))",
            tableName: "Essay", comment: "Under an essay's estimated range"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
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
              .fontWeight(criterion.id == grade.nextStep?.criterionId ? .semibold : .regular)
          }
        }
      } header: {
        Text("Score by criterion", tableName: "Essay", comment: "Each criterion's score")
      }

      Section {
        if let next = grade.nextStep {
          VStack(alignment: .leading, spacing: 4) {
            if let criterion = grade.nextStepCriterion {
              Text(criterion.name).font(.headline)
            }
            Text(next.text)
          }
        } else {
          VStack(alignment: .leading, spacing: 4) {
            Text("Nothing left to work on", tableName: "Essay", comment: "Full marks")
              .font(.headline)
            Text(
              "Every criterion has full marks in this estimate.", tableName: "Essay",
              comment: "Full marks on every criterion"
            )
            .foregroundStyle(.secondary)
          }
        }
      } header: {
        Text("Next step", tableName: "Essay", comment: "The one thing to work on next")
      }

      if let elements = grade.enemInterventionElements {
        Section {
          ForEach(elements.named, id: \.name) { element in
            Label {
              Text(element.name)
            } icon: {
              Image(systemName: element.present ? "checkmark.circle.fill" : "circle.dashed")
                .foregroundStyle(element.present ? .success : .secondary)
            }
            .accessibilityValue(
              element.present
                ? Text("present", tableName: "Essay", comment: "A proposal element is there")
                : Text("missing", tableName: "Essay", comment: "A proposal element is missing"))
          }
        } header: {
          Text(
            "The five elements of the proposal", tableName: "Essay",
            comment: "ENEM's intervention proposal elements")
        }
      }

      Section {
        ForEach(grade.criteria) { criterion in
          DisclosureGroup {
            VStack(alignment: .leading, spacing: 8) {
              if let quote = criterion.quote {
                Text(verbatim: "“\(quote)”")
                  .italic()
                  .foregroundStyle(.secondary)
              }
              Text(criterion.comment)
              if let example = criterion.example {
                Text("For example: \(example)", tableName: "Essay", comment: "A rewrite example")
                  .foregroundStyle(.secondary)
              }
            }
            .font(.callout)
          } label: {
            Text(criterion.name)
          }
        }
      } header: {
        Text("Comments", tableName: "Essay", comment: "Comments on each criterion")
      }
    }
  }
}
