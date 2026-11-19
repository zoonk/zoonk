import SwiftUI

/// A list's groups as one row of small buttons that scrolls sideways, as main's tabs do where
/// there's no room beside the list: the group shown filled, the others outlined. `nil` is every
/// group, and comes first.
struct FilterChips<ID: Hashable, Label: View>: View {
  @Environment(\.accessibilityReduceMotion) private var accessibilityReduceMotion
  let groups: [ID]
  @Binding var selection: ID?
  let name: Text
  @ViewBuilder let label: (ID?) -> Label

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView(.horizontal) {
        LazyHStack(spacing: 8) {
          ForEach(options, id: \.self) { option in
            FilterChip(isSelected: selection == option) {
              selection = option
            } label: {
              label(option)
            }
            .id(option)
          }
        }
      }
      // The row scrolls to the screen's edges while its first chip lines up with the list.
      .scrollClipDisabled()
      .scrollIndicators(.hidden)
      .accessibilityElement(children: .contain)
      .accessibilityLabel(name)
      .onChange(of: selection) { _, selection in
        if accessibilityReduceMotion {
          proxy.scrollTo(selection, anchor: .center)
        } else {
          withAnimation {
            proxy.scrollTo(selection, anchor: .center)
          }
        }
      }
    }
  }

  private var options: [ID?] {
    [nil] + groups.map(Optional.some)
  }
}

private struct FilterChip<Label: View>: View {
  let isSelected: Bool
  let select: () -> Void
  @ViewBuilder let label: Label

  var body: some View {
    Group {
      if isSelected {
        button.buttonStyle(.mainAction)
      } else {
        button.buttonStyle(.outline)
      }
    }
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }

  private var button: some View {
    Button(action: select) {
      HStack(spacing: 6) {
        label
      }
    }
    .controlSize(.small)
  }
}
