import SwiftUI

/// One of the server's pictures of a certificate, a white sheet in light and dark alike. Its place
/// holds the picture's shape while it loads, so nothing moves when it comes.
struct CertificatePicture: View {
  enum Size: Int {
    case thumbnail = 320
    case page = 2048
  }

  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.imageLoader) private var images
  /// The last picture loaded, kept while a renamed certificate's new one loads.
  @State private var loaded: UIImage?
  @State private var isLoading = true

  /// Nil while the certificate's links load.
  let url: URL?
  var size = Size.page

  var body: some View {
    let image = url.flatMap { cached($0) } ?? loaded
    let corner = size == .thumbnail ? 4.0 : 6.0

    ZStack {
      if let image {
        Image(uiImage: image)
          .resizable()
          .scaledToFit()
      } else {
        MediaPendingFill(pulses: isLoading)
      }
    }
    .aspectRatio(CertificateFacts.aspectRatio, contentMode: .fit)
    .clipShape(.rect(cornerRadius: corner, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: corner, style: .continuous)
        .strokeBorder(colorScheme == .dark ? Color.white.opacity(0.1) : Color(.separator))
    }
    .shadow(
      color: size == .page && colorScheme == .light ? .black.opacity(0.08) : .clear,
      radius: 16, y: 6
    )
    .task(id: url) {
      guard let url, let images else {
        return
      }

      isLoading = true
      let image = await images.image(for: url, token: nil, maxPixelSize: size.rawValue)

      guard !Task.isCancelled else {
        return
      }

      loaded = image
      isLoading = false
    }
  }

  private func cached(_ url: URL) -> UIImage? {
    images?.cachedImage(for: url, token: nil, maxPixelSize: size.rawValue)
  }
}
