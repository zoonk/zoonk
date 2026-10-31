import SwiftUI

/// An exam task's estimate on every criterion the task is rated on, saying which ones typed replies
/// or a short answer left without one, and that it's never an official score.
struct ExamSpeakingSections: View {
  private typealias Grade = Components.Schemas.ExamSpeakingFeedback.CriteriaPayloadPayload

  private struct Row: Identifiable {
    let criterion: Components.Schemas.SpeakingCriterion
    let grade: Grade?

    var id: String { criterion.key }
  }

  let task: Components.Schemas.ExamSpeakingTask
  let feedback: Components.Schemas.ExamSpeakingFeedback?
  let language: String

  var body: some View {
    let criteria = task.criteria.map { criterion in
      Row(criterion: criterion, grade: feedback?.criteria.first { $0.criterion == criterion.key })
    }

    if let feedback, criteria.contains(where: { $0.grade != nil }) {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text(task.task.name)
            .font(.title3.weight(.semibold))
            .typesettingLanguage(.init(identifier: language))
          ForEach(notes(feedback), id: \.self) { note in
            Text(note)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
        .padding(.vertical, 4)

        ForEach(criteria) { item in
          if let grade = item.grade {
            DisclosureGroup {
              SpeakingGradeDetails(evidence: grade.evidence, tip: grade.tip)
            } label: {
              row(item.criterion) {
                estimate(grade, isFocus: item.criterion.key == feedback.focus)
              }
            }
          } else {
            row(item.criterion) {
              Text("Not rated", tableName: "Voice", comment: "A criterion without an estimate")
                .foregroundStyle(.secondary)
            }
          }
        }
      } header: {
        Text(
          "\(task.title) · Task \(task.number) of \(task.taskCount)", tableName: "Voice",
          comment: "An exam task's place in its speaking paper")
      } footer: {
        if feedback.heard, task.criteria.contains(where: \.sound) {
          Text(
            "An estimate from one practice task, not an official score. How you sound is rated by how easy you are to understand, never by your accent.",
            tableName: "Voice",
            comment: "An exam task's estimate isn't official; sound is rated for intelligibility")
        } else {
          Text(
            "An estimate from one practice task, not an official score.", tableName: "Voice",
            comment: "An exam task's estimate isn't official")
        }
      }

      if let focus = criteria.first(where: { $0.criterion.key == feedback.focus }),
        let grade = focus.grade
      {
        Section {
          VStack(alignment: .leading, spacing: 4) {
            Text(speakingCriterionName(focus.criterion.key, officialName: focus.criterion.name))
              .font(.headline)
            Text(focus.criterion.name)
              .font(.subheadline)
              .foregroundStyle(.secondary)
              .typesettingLanguage(.init(identifier: language))
          }
          SpeakingGradeDetails(evidence: grade.evidence, tip: grade.tip)
        } header: {
          Text("Work on this first", tableName: "Voice", comment: "The criterion to work on first")
        }
      }
    } else {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text("This task has no estimate", tableName: "Voice", comment: "An ungraded exam task")
            .font(.headline)
          Text(
            "Try the task again when you're ready.", tableName: "Voice",
            comment: "Under an ungraded exam task"
          )
          .foregroundStyle(.secondary)
        }
      }
    }
  }

  private func notes(_ feedback: Components.Schemas.ExamSpeakingFeedback) -> [String] {
    var notes: [String] = []

    if let level = levelLine {
      notes.append(level)
    }

    if !feedback.heard {
      notes.append(
        String(
          localized: "You typed your replies, so this estimate leaves out how you sound.",
          table: "Voice", comment: "A speaking estimate from typed replies"))
    }

    if feedback.brief {
      notes.append(
        String(
          localized:
            "You said little in this task, so there wasn't much to judge. A longer try gives a closer estimate.",
          table: "Voice", comment: "A speaking estimate from a short answer"))
    }

    return notes
  }

  /// Only when every criterion is a numbered band and the scales agree on the level's band.
  private var levelLine: String? {
    let bands = Set(task.criteria.map(\.levelBand))

    guard task.criteria.allSatisfy({ $0.display == .band }), bands.count == 1,
      let band = bands.first, let band
    else {
      return nil
    }

    return String(
      localized: "On these scales, \(band) is the \(task.level.rawValue) level.", table: "Voice",
      comment: "Which band of the exam's scales is its level")
  }

  private func row<Trailing: View>(
    _ criterion: Components.Schemas.SpeakingCriterion, @ViewBuilder trailing: () -> Trailing
  ) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        Text(speakingCriterionName(criterion.key, officialName: criterion.name))
          .fontWeight(.medium)
        Text(criterion.name)
          .font(.caption)
          .foregroundStyle(.secondary)
          .typesettingLanguage(.init(identifier: language))
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      trailing()
    }
  }

  private func estimate(_ grade: Grade, isFocus: Bool) -> some View {
    VStack(alignment: .trailing, spacing: 4) {
      Text(SpeakingEstimateText.text(grade.estimate))
        .fontWeight(.medium)
        .monospacedDigit()
      Group {
        switch grade.standing {
        case .at:
          Text("At \(task.level.rawValue)", tableName: "Voice", comment: "An estimate at the level")
            .foregroundStyle(.success)
        case .near:
          Text(
            "Near \(task.level.rawValue)", tableName: "Voice", comment: "An estimate near the level"
          )
          .foregroundStyle(.secondary)
        case .below:
          Text(
            "Below \(task.level.rawValue)", tableName: "Voice",
            comment: "An estimate below the level"
          )
          .foregroundStyle(.secondary)
        }
      }
      .font(.caption)
      if isFocus {
        Text("Focus", tableName: "Voice", comment: "The criterion to work on first").chip()
      }
    }
  }
}

/// An IELTS or TOEFL speaking mock's band, on every criterion its exam rates.
struct SpeakingMockSections: View {
  private struct Grade {
    let key: String
    let low: Double
    let high: Double
    let evidence: String
    let tip: String
  }

  let feedback: Components.Schemas.LanguageSpeakingMockFeedback?

  var body: some View {
    if let mock {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text(band(low: mock.overall.low, high: mock.overall.high))
            .font(.largeTitle.weight(.semibold).monospacedDigit())
          Text(mock.scale)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
      } footer: {
        Text(
          "An estimate from one short mock, not an official score.", tableName: "Voice",
          comment: "A speaking mock's band isn't official")
      }

      if !mock.grades.isEmpty {
        Section {
          ForEach(mock.expected, id: \.self) { key in
            if let grade = mock.grades.first(where: { $0.key == key }) {
              DisclosureGroup {
                SpeakingGradeDetails(evidence: grade.evidence, tip: grade.tip)
              } label: {
                LabeledContent {
                  Text(band(low: grade.low, high: grade.high))
                    .fontWeight(.medium)
                    .monospacedDigit()
                } label: {
                  name(key, isFocus: key == mock.focus)
                }
              }
            } else {
              LabeledContent {
                Text("Not rated", tableName: "Voice", comment: "A criterion without an estimate")
              } label: {
                name(key, isFocus: key == mock.focus)
              }
            }
          }
        } header: {
          Text("By criterion", tableName: "Voice", comment: "A speaking mock's criteria")
        } footer: {
          if mock.expected.contains(where: { key in !mock.grades.contains { $0.key == key } }) {
            Text(
              "You typed your replies, so this estimate leaves out how you sound.",
              tableName: "Voice", comment: "A speaking estimate from typed replies")
          }
        }

        if let focus = mock.grades.first(where: { $0.key == mock.focus }) {
          Section {
            Text(speakingCriterionName(focus.key, officialName: nil))
              .font(.headline)
            SpeakingGradeDetails(evidence: focus.evidence, tip: focus.tip)
          } header: {
            Text(
              "Work on this first", tableName: "Voice", comment: "The criterion to work on first")
          }
        }
      }
    } else {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          Text("This mock has no score", tableName: "Voice", comment: "An ungraded speaking mock")
            .font(.headline)
          Text(
            "Try another one when you're ready.", tableName: "Voice",
            comment: "Under an ungraded speaking mock"
          )
          .foregroundStyle(.secondary)
        }
      }
    }
  }

  private var mock:
    (
      overall: (low: Double, high: Double), scale: String, expected: [String], grades: [Grade],
      focus: String
    )?
  {
    switch feedback {
    case .ielts(let feedback):
      (
        (feedback.overall.bandLow, feedback.overall.bandHigh),
        String(
          localized: "Estimated band, from 0 to 9", table: "Voice",
          comment: "The IELTS speaking mock's band scale"),
        Components.Schemas.LanguageIeltsSpeakingMockFeedback.CriteriaPayloadPayload
          .CriterionPayload.allCases.map(\.rawValue),
        feedback.criteria.map {
          Grade(
            key: $0.criterion.rawValue, low: $0.bandLow, high: $0.bandHigh, evidence: $0.evidence,
            tip: $0.tip)
        },
        feedback.focus.rawValue
      )
    case .toefl(let feedback):
      (
        (feedback.overall.bandLow, feedback.overall.bandHigh),
        String(
          localized: "Estimated band, from 1 to 6", table: "Voice",
          comment: "The TOEFL speaking mock's band scale"),
        Components.Schemas.LanguageToeflSpeakingMockFeedback.CriteriaPayloadPayload
          .CriterionPayload.allCases.map(\.rawValue),
        feedback.criteria.map {
          Grade(
            key: $0.criterion.rawValue, low: $0.bandLow, high: $0.bandHigh, evidence: $0.evidence,
            tip: $0.tip)
        },
        feedback.focus.rawValue
      )
    case nil:
      nil
    }
  }

  private func name(_ key: String, isFocus: Bool) -> some View {
    HStack(spacing: 8) {
      Text(speakingCriterionName(key, officialName: nil))
        .fontWeight(.medium)
      if isFocus {
        Text("Focus", tableName: "Voice", comment: "The criterion to work on first").chip()
      }
    }
  }

  private func band(low: Double, high: Double) -> String {
    let format = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(1))
    return low == high
      ? low.formatted(format) : "\(low.formatted(format))–\(high.formatted(format))"
  }
}

private struct SpeakingGradeDetails: View {
  let evidence: String
  let tip: String

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(evidence)
        .font(.subheadline)
      Label {
        Text(tip)
      } icon: {
        Image(systemName: "lightbulb")
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }
}

/// Main's `useEstimateText`: the API reads the grade on its scale; this only formats it.
enum SpeakingEstimateText {
  static func text(_ estimate: Components.Schemas.SpeakingEstimate) -> String {
    let number = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(0...2))

    switch estimate {
    case .letter(let letter):
      return span(letter.high, letter.low)
    case .points(let points):
      return String(
        localized:
          "\(span(points.low.formatted(number), points.high.formatted(number))) of \(points.max.formatted(number)) points",
        table: "Voice", comment: "An estimate in the points its bands give, of the line's most")
    case .band(let band):
      return String(
        localized:
          "\(span(band.low.formatted(number), band.high.formatted(number))) of \(band.max.formatted(number))",
        table: "Voice", comment: "An estimated band of the scale's highest")
    }
  }

  private static func span(_ low: String, _ high: String) -> String {
    low == high ? low : "\(low)–\(high)"
  }
}
