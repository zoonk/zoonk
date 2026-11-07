import SwiftUI

/// Main's `SwitchSettingRow`: a row's title over what the switch does, the system switch at its end.
struct SettingToggle: View {
  let isOn: Binding<Bool>
  let title: Text
  var description: Text?

  var body: some View {
    Toggle(isOn: isOn) {
      ListRow(title, description: description)
    }
    .tint(.success)
  }
}
