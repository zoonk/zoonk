import SwiftUI

/// Main's `PickMark`, the same in choice lists and answer options: a radio where one choice is
/// picked, a checkbox where several are. Once picked it fills in ink, the radio with a dot and the
/// checkbox with a check, so its shape says which before any tap. The row is the control, so the
/// mark is unspoken.
struct ChoiceMark: View {
  enum Kind {
    case one
    case several
  }

  let kind: Kind
  let isPicked: Bool

  @Environment(\.colorSchemeContrast) private var contrast
  @Environment(\.typeStyle) private var lineStyle
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibility

  /// Main's 16px mark beside its 14px and 15px words, growing with them.
  @ScaledMetric(relativeTo: .subheadline) private var size = 16.0

  var body: some View {
    let capHeight = lineStyle.uiFont(dynamicTypeSize, legibility: legibility).capHeight

    mark
      .frame(width: size, height: size)
      // Beside text, it centers on the first line's capitals (craft E6).
      .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + capHeight / 2 }
      .accessibilityHidden(true)
  }

  @ViewBuilder
  private var mark: some View {
    switch kind {
    case .one:
      if isPicked {
        Circle()
          .fill(Color(.foreground))
          .overlay {
            Circle()
              .fill(Color(.background))
              .padding(size * 0.27)
          }
      } else {
        Circle().strokeBorder(line, lineWidth: size / 16)
      }
    case .several:
      // A small mark's corner, so an empty checkbox never reads as a radio.
      let square = RoundedRectangle(cornerRadius: 2, style: .continuous)

      if isPicked {
        square
          .fill(Color(.foreground))
          .overlay {
            Check()
              .stroke(
                Color(.background),
                style: StrokeStyle(lineWidth: size * 0.1, lineCap: .round, lineJoin: .round))
          }
      } else {
        square.strokeBorder(line, lineWidth: size / 16)
      }
    }
  }

  /// An empty mark is soft, and as dark as a picked one only when the device asks for more contrast.
  private var line: Color {
    Color(.foreground).opacity(contrast == .increased ? 1 : 0.5)
  }
}

/// Main's check, where it sits in its checkbox.
private struct Check: Shape {
  func path(in rect: CGRect) -> Path {
    Path { path in
      path.move(to: CGPoint(x: rect.minX + rect.width * 0.21, y: rect.minY + rect.height * 0.5))
      path.addLine(
        to: CGPoint(x: rect.minX + rect.width * 0.39, y: rect.minY + rect.height * 0.68))
      path.addLine(
        to: CGPoint(x: rect.minX + rect.width * 0.79, y: rect.minY + rect.height * 0.28))
    }
  }
}

extension View {
  /// A choice VoiceOver reads as a pick of its list: picking several, a toggle that's on or off,
  /// as a checkbox is; picking one, selected.
  func choiceTraits(_ kind: ChoiceMark.Kind, isPicked: Bool) -> some View {
    accessibilityAddTraits(kind == .several ? .isToggle : [])
      .accessibilityAddTraits(isPicked ? .isSelected : [])
  }
}
