import SwiftUI

/// One of the server's pictures of a certificate, a white sheet in light and dark alike. Its place
/// holds the picture's shape while it loads, so nothing moves when it comes.
struct CertificatePicture: View {
  enum Size: Int {
    case thumbnail = 320
    case page = 2048
  }

  @Environment(\.imageLoader) private var images
  /// The last picture loaded, kept while a renamed certificate's new one loads.
  @State private var loaded: UIImage?
  @State private var isLoading = true

  /// Nil while the certificate's links load.
  let url: URL?
  var size = Size.page

  var body: some View {
    let image = url.flatMap { cached($0) } ?? loaded

    ZStack {
      if let image {
        Image(uiImage: image)
          .resizable()
          .scaledToFit()
      } else {
        MediaPendingFill(pulses: isLoading)
      }
    }
    .certificateFrame(size)
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

/// A locked certificate in its picture's place: its frame, a lock, and on a page its name and date.
struct LockedCertificateCard: View {
  let facts: CertificateFacts
  var size = CertificatePicture.Size.page

  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "lock.fill")
        .typeStyle(size == .page ? .section : .body)
        .foregroundStyle(.mutedForeground)

      if size == .page {
        Text(facts.name)
          .typeStyle(.body.weight(.semibold))
          .foregroundStyle(Color(.foreground))
          .multilineTextAlignment(.center)

        Text(facts.completedOnDay)
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(.muted)
    .certificateFrame(size)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "\(facts.name), locked", tableName: "Certificates",
        comment: "VoiceOver for a certificate that comes with Plus: its name, then that it's locked"
      ))
  }
}

extension View {
  /// The certificate's sheet: A4 landscape, rounded, and outlined in light and dark alike.
  fileprivate func certificateFrame(_ size: CertificatePicture.Size) -> some View {
    modifier(CertificateFrame(size: size))
  }
}

private struct CertificateFrame: ViewModifier {
  @Environment(\.colorScheme) private var colorScheme

  let size: CertificatePicture.Size

  func body(content: Content) -> some View {
    let corner = size == .thumbnail ? Radius.sm : Radius.md

    content
      .aspectRatio(CertificateFacts.aspectRatio, contentMode: .fit)
      .clipShape(.rect(cornerRadius: corner, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: corner, style: .continuous)
          .strokeBorder(colorScheme == .dark ? Color.white.opacity(0.1) : Color.border)
      }
  }
}
