import SwiftUI

struct AnyLabelStyle: LabelStyle {
  private let make: (Configuration) -> AnyView

  init(_ style: some LabelStyle) {
    make = { AnyView(style.makeBody(configuration: $0)) }
  }

  func makeBody(configuration: Configuration) -> some View {
    make(configuration)
  }
}
