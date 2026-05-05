import SwiftUI

struct ContentView: View {
    var body: some View {
        AppShell()
    }
}

#Preview("English") {
    ContentView()
        .environment(\.locale, Locale(identifier: "en"))
}

#Preview("Portuguese") {
    ContentView()
        .environment(\.locale, Locale(identifier: "pt"))
}

#Preview("Spanish") {
    ContentView()
        .environment(\.locale, Locale(identifier: "es"))
}
