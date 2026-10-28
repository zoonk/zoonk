import SwiftUI

struct CatalogNumberedRow: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let description: String?
  let imageURL: URL?
  let number: Int
  let symbolTint: Color?
  let systemImage: String
  let title: String

  init(
    description: String?,
    imageURL: URL?,
    number: Int,
    symbolTint: Color? = nil,
    systemImage: String,
    title: String
  ) {
    self.description = description
    self.imageURL = imageURL
    self.number = number
    self.symbolTint = symbolTint
    self.systemImage = systemImage
    self.title = title
  }

  var body: some View {
    HStack(
      alignment: .top,
      spacing: horizontalSizeClass == .regular ? 16 : 12
    ) {
      CourseArtwork(
        imageURL: imageURL,
        cornerRadius: 12,
        symbolTint: symbolTint,
        systemImage: systemImage
      )
      .frame(width: artworkSize, height: artworkSize)

      VStack(
        alignment: .leading,
        spacing: CatalogDetailLayout.curriculumContentSpacing(for: horizontalSizeClass)
      ) {
        Text(numberedTitle)
          .font(.headline)
          .foregroundStyle(.primary)

        if let description = catalogText(description) {
          Text(description)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .accessibilityElement(children: .combine)
  }

  private var artworkSize: CGFloat {
    horizontalSizeClass == .regular && !dynamicTypeSize.isAccessibilitySize ? 64 : 56
  }

  private var numberedTitle: String {
    "\(number.formatted()). \(title)"
  }
}
