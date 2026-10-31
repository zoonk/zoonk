import SwiftUI

extension View {
  /// Only a window's topmost layer can present, so each layer says whether it's that one.
  func asksBirthYear(here isTopmost: Bool) -> some View {
    modifier(BirthYearPresentation(isTopmost: isTopmost))
  }
}

private struct BirthYearPresentation: ViewModifier {
  @Environment(BirthYearGate.self) private var gate

  let isTopmost: Bool

  func body(content: Content) -> some View {
    content.sheet(
      isPresented: Binding(
        get: { isTopmost && gate.prompt != nil },
        set: { isPresented in
          if !isPresented {
            gate.close()
          }
        })
    ) {
      BirthYearSheet(prompt: gate.prompt ?? .question(canCancel: false))
    }
  }
}

/// Neutral: no year is offered, and no age is assumed.
private struct BirthYearSheet: View {
  @Environment(BirthYearGate.self) private var gate
  /// The last prompt shown stays while the sheet slides away.
  @State private var prompt: BirthYearGate.Prompt
  @State private var draft = ""
  @FocusState private var isFocused: Bool
  @AccessibilityFocusState private var isMessageFocused: Bool

  init(prompt: BirthYearGate.Prompt) {
    _prompt = State(initialValue: prompt)
  }

  var body: some View {
    NavigationStack {
      switch prompt {
      case .question(let canCancel):
        question(canCancel: canCancel)
      case .belowMinimumAge(let minimumAge, let logsOut):
        belowMinimumAge(minimumAge, logsOut: logsOut)
      }
    }
    .interactiveDismissDisabled(!canClose || gate.isSaving)
    .onChange(of: gate.prompt) { _, next in
      if let next {
        prompt = next
      }
    }
  }

  /// Only a visitor can close it: an account answers, or logs out.
  private var canClose: Bool {
    switch prompt {
    case .question(let canCancel): canCancel
    case .belowMinimumAge(_, let logsOut): !logsOut
    }
  }

  private var year: Int? {
    draft.count == 4 ? draft.reduce(0) { $0 * 10 + ($1.wholeNumberValue ?? 0) } : nil
  }

  private func question(canCancel: Bool) -> some View {
    let notNow: (() -> Void)? = canCancel ? { gate.close() } : nil

    return Form {
      StepHeader(
        title: title,
        description: Text(
          "We ask everyone once.", tableName: "BirthYear",
          comment: "Under the birth year question")
      )

      Section {
        TextField(text: $draft) {
          Text(
            "Birth year", tableName: "BirthYear",
            comment: "Label of the field where the learner types the year they were born")
        }
        .keyboardType(.numberPad)
        .textContentType(.birthdateYear)
        .focused($isFocused)
        .onChange(of: draft) {
          draft = String(draft.filter { ($0.wholeNumberValue ?? 10) < 10 }.prefix(4))
        }
      } footer: {
        if let failure = gate.failure {
          failureMessage(failure)
        }
      }

      StepButtons(
        canContinue: year != nil,
        skipLabel: Text(
          "Not now", tableName: "BirthYear",
          comment: "Closes the birth year question; nothing starts"),
        onContinue: {
          if let year {
            Task {
              await gate.submit(year)
            }
          }
        },
        onSkip: notNow)
    }
    .disabled(gate.isSaving)
    .environment(\.isSavingAnswer, gate.isSaving)
    .onAppear {
      isFocused = true
    }
    .barName(title)
  }

  private var title: Text {
    Text(
      "What year were you born?", tableName: "BirthYear",
      comment: "Asked once of every learner before they keep learning")
  }

  private func failureMessage(_ failure: BirthYearGate.Failure) -> some View {
    Label {
      switch failure {
      case .invalidYear:
        Text(
          "Check the year and try again.", tableName: "BirthYear",
          comment: "The four-digit birth year typed isn't a real one, such as one in the future")
      case .unsaved:
        Text(
          "That didn't save. Try again.", tableName: "BirthYear",
          comment: "Saving the birth year failed, usually the connection")
      }
    } icon: {
      Image(systemName: "exclamationmark.circle")
    }
    .foregroundStyle(.destructive)
    .accessibilityElement(children: .combine)
  }

  private func belowMinimumAge(_ minimumAge: Int, logsOut: Bool) -> some View {
    ContentUnavailableView {
      Label {
        Text(
          "Not just yet", tableName: "BirthYear",
          comment: "Title when the learner is too young to use Zoonk")
      } icon: {
        Image(systemName: "hourglass")
      }
    } description: {
      Group {
        if logsOut {
          Text(
            "You need to be \(minimumAge) or older to use Zoonk, so we'll log you out. We'll be here when you are.",
            tableName: "BirthYear",
            comment:
              "Tells a signed-in learner below the minimum age kindly that OK logs them out; the number is that age"
          )
        } else {
          Text(
            "You need to be \(minimumAge) or older to use Zoonk. We'll be here when you are.",
            tableName: "BirthYear",
            comment: "Tells a learner below the minimum age kindly; the number is that age")
        }
      }
      .accessibilityFocused($isMessageFocused)
    } actions: {
      Button {
        if logsOut {
          Task {
            await gate.logOut()
          }
        } else {
          gate.close()
        }
      } label: {
        Text("OK", tableName: "BirthYear", comment: "Closes the message for a learner too young")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
      .disabled(gate.isSaving)
    }
    .onAppear {
      isMessageFocused = true
    }
  }
}
