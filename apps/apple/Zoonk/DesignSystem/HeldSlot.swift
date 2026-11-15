import SwiftUI

/// Main's `useHeldSlot`: a gate that lifts by itself, with no tap, leaves its slot as tall as it was
/// for the rest of the visit, so what's below doesn't move under the learner's finger; what replaces
/// it sits at the top. The height belongs to the width and text size it was measured at: either one
/// changing starts again from the natural height. The next visit takes the natural height.
struct HeldSlot<Content: View>: View {
  @Environment(\.dynamicTypeSize) private var typeSize
  @State private var held: Held?

  let gated: Bool
  /// Where the content sits across the slot, such as centered under a centered title.
  var alignment = HorizontalAlignment.leading
  @ViewBuilder let content: Content

  var body: some View {
    // A stack is there even when the content that lifted draws nothing, so the room can be held.
    VStack(alignment: alignment, spacing: 0) {
      content
    }
    .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
    // Measured before the held height applies, so it reads what the content needs.
    .onGeometryChange(for: CGSize.self, of: \.size) { size in
      let sameLayout = held?.width == size.width && held?.typeSize == typeSize

      // The tallest it has been in this layout: its line can go a moment before the gate does.
      if gated {
        held = Held(
          width: size.width, typeSize: typeSize,
          height: max(sameLayout ? held?.height ?? 0 : 0, size.height))
      } else if !sameLayout {
        held = nil
      }
    }
    .frame(
      minHeight: held?.height ?? 0, alignment: Alignment(horizontal: alignment, vertical: .top))
  }
}

private struct Held {
  let width: CGFloat
  let typeSize: DynamicTypeSize
  let height: CGFloat
}
