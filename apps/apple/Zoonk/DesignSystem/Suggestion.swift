import SwiftUI

/// Main's `SuggestionMark`: a suggestion's own mark is muted; one without (an offer of more lessons
/// or of more time) takes the warning sparkle.
struct SuggestionMark: View {
  enum Kind {
    case sparkle
    case done
    case symbol(String)
  }

  let kind: Kind

  var body: some View {
    switch kind {
    case .sparkle:
      Image(systemName: "sparkle")
        .foregroundStyle(.warning)
    case .done:
      StatusMark(status: .done)
    case .symbol(let name):
      Image(systemName: name)
        .foregroundStyle(.mutedForeground)
    }
  }
}

/// Main's `SuggestionLine`: a panel with the suggestion's mark, its summary in two lines at most,
/// and one small action at its end; stacked, the whole summary and the action under it.
struct SuggestionLine<Mark: View, Summary: View, Action: View>: View {
  @Environment(\.stacksContent) private var isStacked

  @ViewBuilder let mark: Mark
  @ViewBuilder let summary: Summary
  @ViewBuilder let action: Action

  var body: some View {
    // Stacked, two lines of large text say too little, so the summary wraps whole and the action
    // goes under it.
    let layout =
      isStacked
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
      : AnyLayout(HStackLayout(spacing: 10))

    layout {
      HStack(alignment: isStacked ? .firstTextBaseline : .center, spacing: 10) {
        mark
          .accessibilityHidden(true)

        summary
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .lineLimit(isStacked ? nil : 2)
          .frame(maxWidth: .infinity, alignment: .leading)
      }

      action
    }
    .padding(.leading, 12)
    .padding(.trailing, 8)
    .padding(.vertical, 8)
    .frame(minHeight: 48)
    .panel()
  }
}

/// Main's `SuggestionOpen`: "View", which opens the whole suggestion in a sheet. An answer that
/// replaces the line takes the button away, and the sheet closes with it. `isOpen` keeps it open
/// across a fold where the screen owns that state.
struct SuggestionOpen<Content: View>: View {
  var isOpen: Binding<Bool>?
  @ViewBuilder let content: Content

  @State private var isOpenHere = false

  private var shown: Binding<Bool> { isOpen ?? $isOpenHere }

  var body: some View {
    SuggestionViewButton {
      shown.wrappedValue = true
    }
    .sheet(isPresented: shown) {
      SuggestionSheet {
        content
      }
      .zoonkStyles()
    }
  }
}

/// `SuggestionOpen`'s "View", for a screen that presents the sheet itself, above panes that a
/// resize or a fold rebuilds.
struct SuggestionViewButton: View {
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Text("View", tableName: "Plan", comment: "Opens the Plan's suggestion in full")
    }
    .buttonStyle(.outline)
    .controlSize(.small)
  }
}

/// `SuggestionOpen`'s sheet: the whole suggestion, closed with its close button or by any place
/// opened from it, such as a finished plan's next course.
struct SuggestionSheet<Content: View>: View {
  @Environment(\.dismiss) private var dismiss

  @ViewBuilder let content: Content

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 8) {
          content
        }
        .controlSize(.large)
        .padding()
      }
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
    .presentationDetents([.medium, .large])
    .closesOnNavigation()
  }
}

/// Main's `SuggestionSaveError`: an answer or its Undo didn't save. It sits with the buttons that
/// made it, in the sheet when they're there, and VoiceOver hears it as it appears.
struct SuggestionSaveError: View {
  private static let message = LocalizedStringResource(
    "That didn't save. Try again.", table: "Plan",
    comment: "A plan suggestion's change or its Undo didn't save; trying again may work")

  var body: some View {
    Text(Self.message)
      .typeStyle(.note)
      .foregroundStyle(.destructiveText)
      .announcesAlert(String(localized: Self.message))
  }
}
