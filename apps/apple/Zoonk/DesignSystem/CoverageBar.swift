import SwiftUI

/// Main's `CoverageBar`: what is done of a goal's lessons, studied or already known, on one track.
/// The share is 0 to 1.
struct CoverageBar: View {
  let done: Double

  var body: some View {
    Canvas { context, size in
      let track = Path(
        roundedRect: CGRect(origin: .zero, size: size), cornerRadius: size.height / 2)

      context.fill(track, with: .color(.surface3))
      context.clip(to: track)
      context.fill(
        Path(CGRect(x: 0, y: 0, width: size.width * min(max(done, 0), 1), height: size.height)),
        with: .color(.success))
    }
    .frame(height: 6)
    .accessibilityHidden(true)
  }
}
