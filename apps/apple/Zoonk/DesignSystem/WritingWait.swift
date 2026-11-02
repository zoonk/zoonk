import SwiftUI

struct WritingWait: View {
  let title: Text
  let hint: Text

  var body: some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        title
        hint
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    } icon: {
      ProgressView()
    }
    .accessibilityElement(children: .combine)
  }
}
