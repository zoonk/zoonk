import SwiftUI

/// Main's `MockResultPoints`: each test with its minimum, misses first, in words and numbers. A full
/// mock says whether the learner would be eliminated; a half mock only projects.
struct MockPointsSection: View {
  let points: MockPoints

  var body: some View {
    Section {
      if let verdict = points.verdict {
        Label {
          Text(verdict.text)
        } icon: {
          Image(systemName: verdict.met ? "checkmark" : "xmark")
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(verdict.met ? AnyShapeStyle(.primary) : AnyShapeStyle(.destructive))
      }

      ForEach(points.tests, id: \.name) { test in
        LabeledContent {
          Text(test.score)
            .monospacedDigit()
        } label: {
          Text(
            test.name
              ?? String(
                localized: "Objective tests together", table: "Mock",
                comment: "A mock result's row for the exam's objective tests counted together"))

          if let requirement = test.requirement {
            // A Label here splits into two lines of the label, so the mark sits beside the words.
            HStack(alignment: .firstTextBaseline, spacing: 4) {
              if let met = test.met {
                Image(systemName: met ? "checkmark" : "xmark")
                  .accessibilityHidden(true)
              }

              Text(requirement)
            }
            .foregroundStyle(
              test.met == false ? AnyShapeStyle(.destructive) : AnyShapeStyle(.secondary))
          }
        }
        .accessibilityElement(children: .combine)
      }
    } header: {
      Text("By test", tableName: "Mock", comment: "Each test's points in a mock's result")
    } footer: {
      let lines = [points.projection].compactMap { $0 } + points.unjudged.map(\.line)

      if !lines.isEmpty {
        VStack(alignment: .leading, spacing: 4) {
          ForEach(lines, id: \.self) { Text($0) }
        }
      }
    }
  }
}

extension MockPoints {
  var verdict: (met: Bool, text: String)? {
    let tests = self.tests

    guard tests.contains(where: { $0.met != nil }) else {
      return nil
    }

    guard let first = tests.first, first.met == false, let minimum = first.minimum else {
      return (
        true,
        String(
          localized: "Meets the objective minimums checked here.", table: "Mock",
          comment: "A full mock's result reached every minimum it could check")
      )
    }

    let needed = MockLabels.minimum(minimum)
    let short = MockLabels.points(first.short ?? 0)
    let score = MockLabels.percent(first.scorePercent)

    let text =
      switch (first.name, minimum.unit) {
      case (nil, .percent):
        String(
          localized:
            "You'd be eliminated: the objective tests together reach \(score), below the \(needed) they need.",
          table: "Mock",
          comment:
            "Eliminated: the exam's rules disqualify a candidate below this minimum, whatever their total. A full mock missed the objective tests' minimum share"
        )
      case (nil, .points):
        String(
          localized:
            "You'd be eliminated: the objective tests together are \(short) short of \(needed).",
          table: "Mock",
          comment:
            "Eliminated: the exam's rules disqualify a candidate below this minimum, whatever their total. A full mock missed the objective tests' minimum; the first argument is like '2 points'"
        )
      case (let name?, .percent):
        String(
          localized: "You'd be eliminated: \(name) is at \(score), below the \(needed) it needs.",
          table: "Mock",
          comment:
            "Eliminated: the exam's rules disqualify a candidate below this minimum, whatever their total. A full mock missed a test's minimum share"
        )
      case (let name?, .points):
        String(
          localized: "You'd be eliminated: \(name) is \(short) short of \(needed).", table: "Mock",
          comment:
            "Eliminated: the exam's rules disqualify a candidate below this minimum, whatever their total. A full mock missed a test's minimum; the second argument is like '2 points'"
        )
      }

    return (false, text)
  }

  var projection: String? {
    if let projected, let max {
      return String(
        localized:
          "About \(MockLabels.number(projected)) of \(MockLabels.number(max)) points on the whole exam, projected from this mock. Only a full mock says whether you'd reach the minimums.",
        table: "Mock", comment: "A half mock's points projected onto the whole exam")
    }

    guard parts.contains(where: { $0.projected != nil }) else {
      return nil
    }

    return String(
      localized:
        "Each test's points are projected onto its whole length. Only a full mock says whether you'd reach the minimums.",
      table: "Mock", comment: "A half mock's points per test, projected onto each whole test")
  }
}

extension MockPoints.Test {
  var score: String {
    MockLabels.points(projected ?? earned, of: max ?? asked)
  }

  var scorePercent: Double {
    asked > 0 ? earned / asked * 100 : 0
  }

  var requirement: String? {
    let lines = [
      minimum.map(requirement),
      qualifying
        ? String(
          localized: "Doesn't count toward the total", table: "Mock",
          comment: "A qualifying test that only has to reach its minimum")
        : nil,
    ].compactMap { $0 }

    return lines.isEmpty ? nil : lines.joined(separator: " · ")
  }

  private func requirement(_ minimum: PointsMinimum) -> String {
    let needed = MockLabels.minimum(minimum)

    switch (met, minimum.unit) {
    case (false?, .percent):
      return String(
        localized: "At \(MockLabels.percent(scorePercent)), below the \(needed) it needs",
        table: "Mock", comment: "A test that missed its minimum share of points")
    case (false?, .points):
      return String(
        localized: "\(MockLabels.points(short ?? 0)) short of the \(needed) it needs",
        table: "Mock",
        comment: "A test that missed its minimum; the first argument is like '2 points'")
    case (true?, let unit):
      let reached = unit == .percent ? needed : MockLabels.points(minimum.value)

      return String(
        localized: "Reached the \(reached) it needs", table: "Mock",
        comment: "A test that reached its minimum; the argument is like '8 points' or '50%'")
    case (nil, .percent):
      return String(
        localized: "Needs \(needed) of its points", table: "Mock",
        comment: "A test's minimum share of points, which this mock doesn't judge")
    case (nil, .points):
      return String(
        localized: "Needs \(MockLabels.points(minimum.value))", table: "Mock",
        comment: "A test's minimum, which this mock doesn't judge; the argument is like '8 points'")
    }
  }
}

extension MockPoints.Unjudged {
  var line: String {
    switch (name, minimum.unit) {
    case (nil, .percent):
      String(
        localized:
          "The objective tests together need \(MockLabels.minimum(minimum)) of their points, and this mock doesn't have them all.",
        table: "Mock", comment: "A minimum share of points this mock couldn't check")
    case (nil, .points):
      String(
        localized:
          "The objective tests together need \(MockLabels.points(minimum.value)), and this mock doesn't have them all.",
        table: "Mock",
        comment: "A minimum this mock couldn't check; the argument is like '60 points'")
    case (let name?, .percent):
      String(
        localized:
          "\(name) needs \(MockLabels.minimum(minimum)) of its points and isn't in this mock.",
        table: "Mock", comment: "A test's minimum share of points this mock couldn't check")
    case (let name?, .points):
      String(
        localized: "\(name) needs \(MockLabels.points(minimum.value)) and isn't in this mock.",
        table: "Mock",
        comment: "A test's minimum this mock couldn't check; the second argument is like '8 points'"
      )
    }
  }
}
