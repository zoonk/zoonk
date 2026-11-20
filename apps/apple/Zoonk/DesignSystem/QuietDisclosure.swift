import SwiftUI

/// Main's `QuietDisclosure`: a small muted label and chevron that opens what most learners don't
/// need, such as every change a plan change makes or where a number comes from.
struct QuietDisclosure<Content: View>: View {
  let label: Text
  @ViewBuilder let content: Content

  @State private var isOpen = false

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      Button {
        isOpen.toggle()
      } label: {
        HStack(spacing: 4) {
          label

          Image(systemName: "chevron.down")
            .imageScale(.small)
            .rotationEffect(.degrees(isOpen ? 180 : 0))
            .accessibilityHidden(true)
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
        .frame(minHeight: 44, alignment: .leading)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
      .accessibilityValue(
        isOpen
          ? Text("Expanded", tableName: "DesignSystem", comment: "VoiceOver: a fold that is open")
          : Text(
            "Collapsed", tableName: "DesignSystem", comment: "VoiceOver: a fold that is closed"))

      if isOpen {
        content
      }
    }
  }
}
