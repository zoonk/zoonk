import SwiftUI

struct CatalogNumberedRow<Metadata: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let description: String?
  let imageURL: URL?
  let number: Int
  let systemImage: String
  let title: String
  @ViewBuilder let metadata: Metadata

  init(
    description: String?,
    imageURL: URL?,
    number: Int,
    systemImage: String,
    title: String,
    @ViewBuilder metadata: () -> Metadata
  ) {
    self.description = description
    self.imageURL = imageURL
    self.number = number
    self.systemImage = systemImage
    self.title = title
    self.metadata = metadata()
  }

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Text(number.formatted())
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .monospacedDigit()
        .frame(width: 20, alignment: .trailing)
        .padding(.top, 2)

      CourseArtwork(
        imageURL: imageURL,
        cornerRadius: 12,
        systemImage: systemImage
      )
      .frame(width: artworkSize, height: artworkSize)

      VStack(alignment: .leading, spacing: 4) {
        Text(title)
          .font(.headline)
          .foregroundStyle(.primary)

        if let description = catalogText(description) {
          Text(description)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
        }

        metadata
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .accessibilityElement(children: .combine)
  }

  private var artworkSize: CGFloat {
    horizontalSizeClass == .regular && !dynamicTypeSize.isAccessibilitySize ? 64 : 56
  }
}
