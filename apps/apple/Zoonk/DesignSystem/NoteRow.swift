import SwiftUI

struct NoteRow<Lines: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibility

  let title: Text
  let systemImage: String
  @ViewBuilder let lines: Lines

  init(_ title: Text, systemImage: String, @ViewBuilder lines: () -> Lines) {
    self.title = title
    self.systemImage = systemImage
    self.lines = lines()
  }

  var body: some View {
    let titleStyle = TypeStyle.body.weight(.semibold)
    let capHeight = titleStyle.uiFont(dynamicTypeSize, legibility: legibility).capHeight

    Group(subviews: lines) { descriptions in
      RowLayout(alignment: descriptions.count >= 2 ? .noteMark : .center) {
        Image(systemName: systemImage)
          .foregroundStyle(.mutedForeground)
          .accessibilityHidden(true)
      } words: {
        VStack(alignment: .leading, spacing: 4) {
          title
            .layoutPart(.label, text: title)
            .typeStyle(titleStyle)
            .alignmentGuide(.noteMark) { $0[.firstTextBaseline] - capHeight / 2 }

          ForEach(descriptions) { description in
            description
              .foregroundStyle(.mutedForeground)
              .layoutPart(.note)
          }
        }
      } value: {
        EmptyView()
      }
    }
  }
}

extension VerticalAlignment {
  fileprivate static let noteMark = VerticalAlignment(NoteMarkAlignment.self)

  private struct NoteMarkAlignment: AlignmentID {
    static func defaultValue(in context: ViewDimensions) -> CGFloat {
      context[VerticalAlignment.center]
    }
  }
}
