import SwiftUI

extension ActivityRenderer {
  static let beforeAfter = ActivityRenderer(template: "beforeAfter") { context in
    if let fields = try? context.fields(as: BeforeAfterFields.self) {
      BeforeAfterCanvas(fields: fields, context: context)
    }
  }
}

struct BeforeAfterFields: Decodable, Hashable, Sendable {
  struct Fact: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let unit: String?
    let value: Double
  }

  struct State: Decodable, Hashable, Sendable {
    let description: String
    let facts: [Fact]
    let label: String
  }

  let after: State
  let before: State
  let change: String

  /// After divided by before for a fact, the number a numeric check grades.
  func ratio(_ factId: String) -> Double? {
    guard let before = before.facts.first(where: { $0.id == factId })?.value,
      let after = after.facts.first(where: { $0.id == factId })?.value, before != 0
    else {
      return nil
    }

    return after / before
  }
}

/// How a fact changed, the way people say it: "8.3 times less" for big changes, "+15%" for small
/// ones, as main's `describeChange`.
enum FactChange: Hashable {
  case same
  case less(Double)
  case more(Double)
  case percent(Double)

  init(ratio: Double) {
    if abs(ratio - 1) < 1e-9 {
      self = .same
    } else if ratio > 0, ratio <= 0.5 {
      self = .less(Self.twoDigits(1 / ratio))
    } else if ratio >= 2 {
      self = .more(Self.twoDigits(ratio))
    } else {
      self = .percent(Self.twoDigits((ratio - 1) * 100))
    }
  }

  /// Two significant digits, as JavaScript's `Number(value.toPrecision(2))`.
  static func twoDigits(_ value: Double) -> Double {
    Double(String(format: "%.1e", value)) ?? value
  }
}

/// Two states of the same thing with what changed between them. The learner reads the before state
/// and the change, then shows the after state: its bars start at the before length and move to
/// their own (at once with Reduce Motion). Once checked, each fact says how much it changed.
private struct BeforeAfterCanvas: View {
  let fields: BeforeAfterFields
  let context: ActivityCanvasContext

  @State private var isRevealed = false
  @State private var isSettled = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @AccessibilityFocusState private var isAfterFocused: Bool

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var highlightId: String? {
    guard case .numeric(_, _, _, _, _, _, let output) = context.check else {
      return nil
    }

    return output ?? fields.before.facts.first?.id
  }

  var body: some View {
    let showsAfter = isRevealed || isChecked

    VStack(alignment: .leading, spacing: 12) {
      stateCard(fields.before, other: fields.after, isAfter: false)

      Label {
        LessonRichText(fields.change)
      } icon: {
        Image(systemName: "arrow.down")
      }
      .font(.subheadline)

      if showsAfter {
        stateCard(fields.after, other: fields.before, isAfter: true)
          .accessibilityFocused($isAfterFocused)
          .onAppear {
            withAnimation(reduceMotion ? nil : .easeOut(duration: 0.7)) {
              isSettled = true
            }
          }
      } else {
        Button {
          isRevealed = true
          isAfterFocused = true
        } label: {
          Text(
            "Show after: \(fields.after.label)", tableName: "Activities",
            comment: "Reveals the after state of a before-and-after comparison"
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
      }
    }
  }

  private func stateCard(
    _ state: BeforeAfterFields.State, other: BeforeAfterFields.State, isAfter: Bool
  )
    -> some View
  {
    VStack(alignment: .leading, spacing: 12) {
      Text(state.label)
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(.secondary)
        .accessibilityAddTraits(.isHeader)

      ForEach(state.facts) { fact in
        factRow(fact, other: other.facts.first { $0.id == fact.id }, isAfter: isAfter)
      }

      LessonRichText(state.description)
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(
      isAfter ? Color.mint.opacity(0.15) : Color(.secondarySystemBackground),
      in: .rect(cornerRadius: 16)
    )
    .accessibilityElement(children: .contain)
  }

  private func factRow(
    _ fact: BeforeAfterFields.Fact, other: BeforeAfterFields.Fact?, isAfter: Bool
  )
    -> some View
  {
    let largest = max(abs(fact.value), abs(other?.value ?? 0))
    let own = largest == 0 ? 0 : abs(fact.value) / largest
    let otherShare = largest == 0 ? 0 : abs(other?.value ?? 0) / largest
    let share = isAfter && !isSettled ? otherShare : own
    let change = isChecked && isAfter ? fields.ratio(fact.id).map(FactChange.init(ratio:)) : nil

    return VStack(alignment: .leading, spacing: 4) {
      HStack(alignment: .firstTextBaseline) {
        Text(fact.label)
        Spacer(minLength: 8)
        Text(ActivityNumberFormat.format(fact.value, unit: fact.unit))
          .fontWeight(.semibold)
          .monospacedDigit()
      }
      .font(.subheadline)

      ProgressView(value: share)
        .tint(isAfter ? Color.mint : Color.secondary)
        .accessibilityHidden(true)

      if let change {
        changeText(change)
          .font(.caption.weight(.semibold).monospacedDigit())
          .foregroundStyle(fact.id == highlightId ? Color.success : .primary)
      }
    }
    .accessibilityElement(children: .combine)
  }

  private func changeText(_ change: FactChange) -> Text {
    switch change {
    case .same:
      Text(
        "No change", tableName: "Activities", comment: "A fact that is the same before and after")
    case .less(let times):
      Text(
        "\(ActivityNumberFormat.format(times)) times less", tableName: "Activities",
        comment: "How many times smaller a fact is after a change")
    case .more(let times):
      Text(
        "\(ActivityNumberFormat.format(times)) times more", tableName: "Activities",
        comment: "How many times bigger a fact is after a change")
    case .percent(let percent):
      Text(verbatim: ActivityNumberFormat.format(percent, unit: "%", signed: true))
    }
  }
}
