import SwiftUI

struct ColumnSwitchStyle: ToggleStyle {
  func makeBody(configuration: Configuration) -> some View {
    Toggle(configuration)
      .toggleStyle(.switch)
      // The system switch's ink extends 2pt past its layout frame on iOS 27.
      .padding(.trailing, 2)
  }
}
