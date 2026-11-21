import SwiftUI

/// Main's `WeekdayToggle` grid, for the days a learner studies: the week's seven days in one row of
/// equal cells, Monday to Sunday as the plan's week runs in every language. On, a day is the pick's
/// soft fill with its name in ink; off, its bare, faint name, so on and off are told apart without
/// reading; more contrast gives both their line. VoiceOver reads each as a switch named for its whole
/// weekday. Where seven names can't share a row, at the larger text sizes, the days are a list of
/// switches instead, one row each. A weekday is 0 for Sunday to 6 for Saturday, as the plan counts
/// them. Put it in a `Section`, so the list's rows are the section's.
struct WeekdayToggles: View {
  let isOn: (Int) -> Bool
  let onToggle: (Int, Bool) -> Void
  var isEnabled: (Int) -> Bool = { _ in true }

  @Environment(\.dynamicTypeSize) private var typeSize
  @Environment(\.legibilityWeight) private var legibility
  /// The room a row has, the same for the cells and the list, so either one measures it.
  @State private var width: CGFloat?

  var body: some View {
    if width.map({ Self.fits(width: $0, typeSize: typeSize, legibility: legibility) }) ?? true {
      HStack(spacing: Self.gap) {
        ForEach(ScheduleTime.mondayFirst, id: \.self) { weekday in
          Toggle(
            PlanDate.weekdayName(number: weekday, short: true, label: true),
            isOn: binding(weekday)
          )
          .toggleStyle(DayCell())
          .accessibilityRepresentation {
            Toggle(PlanDate.weekdayName(number: weekday, label: true), isOn: binding(weekday))
          }
          .disabled(!isEnabled(weekday))
        }
      }
      .measuresRow($width)
    } else {
      ForEach(ScheduleTime.mondayFirst, id: \.self) { weekday in
        Toggle(PlanDate.weekdayName(number: weekday, label: true), isOn: binding(weekday))
          .disabled(!isEnabled(weekday))
          .measuresRow($width)
      }
      .tint(.success)
    }
  }

  private func binding(_ weekday: Int) -> Binding<Bool> {
    Binding(get: { isOn(weekday) }, set: { onToggle(weekday, $0) })
  }

  private static let gap: CGFloat = 4
  private static let padding: CGFloat = 4

  /// Whether every day's short name fits a seventh of the row, as main's grid measures them.
  static func fits(
    width: CGFloat, typeSize: DynamicTypeSize, legibility: LegibilityWeight?,
    locale: Locale = .autoupdatingCurrent
  ) -> Bool {
    let font = TypeStyle.rowTitle.uiFont(typeSize, legibility: legibility)
    let cell = (width - gap * 6) / 7 - padding * 2

    return ScheduleTime.mondayFirst.allSatisfy { weekday in
      let name = PlanDate.weekdayName(number: weekday, short: true, label: true, locale: locale)
      return ceil((name as NSString).size(withAttributes: [.font: font]).width) <= cell
    }
  }
}

/// Main's `cell` toggle: a 44pt cell, the pick's fill on, the faint name off.
private struct DayCell: ToggleStyle {
  func makeBody(configuration: Configuration) -> some View {
    Button {
      configuration.isOn.toggle()
    } label: {
      configuration.label
    }
    .buttonStyle(DayCellButton(isOn: configuration.isOn))
  }
}

private struct DayCellButton: ButtonStyle {
  let isOn: Bool

  @Environment(\.colorSchemeContrast) private var contrast
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    let shape = RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)

    configuration.label
      .typeStyle(.rowTitle)
      .lineLimit(1)
      .fixedSize()
      .foregroundStyle(isOn ? Color(.foreground) : .faint)
      .frame(maxWidth: .infinity, minHeight: ZoonkButtonStyle.height(.large))
      .background(fill(isPressed: configuration.isPressed), in: shape)
      .overlay(shape.strokeBorder(contrast == .increased ? Color.input : .clear))
      .contentShape(shape)
      .opacity(isEnabled ? 1 : 0.5)
  }

  private func fill(isPressed: Bool) -> Color {
    if isOn {
      return .selectedTint
    }

    return isPressed ? Color.muted.opacity(0.6) : .clear
  }
}

extension View {
  fileprivate func measuresRow(_ width: Binding<CGFloat?>) -> some View {
    onGeometryChange(for: CGFloat.self, of: \.size.width) { width.wrappedValue = $0 }
  }
}
