import SwiftUI

/// The Buddy tab before there's a goal to tutor: instead of a dead end, the buddy says what it does
/// with one and takes it right here, then opens the goal start with the same words, so the
/// learner never types them twice. An example fills the field for the learner to edit first.
struct BuddyGoalStart: View {
  @Environment(BuddyStore.self) private var store
  @Environment(\.tutorPlaces) private var places

  let name: String
  @Binding var goal: String

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 16) {
        // The hello says the buddy is an AI, since it opens the conversation.
        Text(
          "Hi! I'm \(name), your AI study buddy. What do you want to learn, and by when? I'll turn it into a plan for every day until then.",
          tableName: "Buddy",
          comment: "The buddy's hello before the learner has a goal; the argument is its name")

        if case .loaded = store.earlierQuestions.state {
          Button {
            places.open(.earlierQuestions)
          } label: {
            Label {
              Text(
                "Earlier questions", tableName: "Buddy",
                comment: "Opens questions asked before the courses were rewritten")
            } icon: {
              Image(systemName: "clock.arrow.circlepath")
            }
          }
          .buttonStyle(.borderless)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .scenePadding()
    }
    .defaultScrollAnchor(.bottom, for: .initialOffset)
    .scrollDismissesKeyboard(.interactively)
    .safeAreaBar(edge: .bottom) {
      VStack(alignment: .leading, spacing: 10) {
        ScrollView(.horizontal) {
          HStack(spacing: 8) {
            ForEach(examples, id: \.self) { example in
              Button(example) {
                goal = example
              }
              .buttonStyle(.bordered)
              .buttonBorderShape(.capsule)
            }
          }
        }
        .scrollIndicators(.hidden)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
          Text("Examples", tableName: "Buddy", comment: "Example goals filled in with one tap"))

        HStack(alignment: .bottom, spacing: 8) {
          TextField(
            text: $goal,
            prompt: Text(
              "What you want to learn", tableName: "Buddy", comment: "Placeholder of the goal field"
            ),
            axis: .vertical
          ) {
            Text("Your goal", tableName: "Buddy", comment: "The goal field for VoiceOver")
          }
          .lineLimit(1...4)
          .onSubmit(start)
          .padding(.leading, 16)
          .padding(.vertical, 12)

          Button(action: start) {
            Text("Build my plan", tableName: "Buddy", comment: "Starts a goal with the words typed")
          }
          .buttonStyle(.mainAction)
          .disabled(trimmedGoal.isEmpty)
          .padding(6)
        }
        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 24, style: .continuous))
      }
      .scenePadding(.horizontal)
      .padding(.vertical, 8)
    }
  }

  private var trimmedGoal: String {
    goal.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private func start() {
    guard !trimmedGoal.isEmpty else {
      return
    }

    places.open(.startGoal(goal: trimmedGoal))
  }

  /// Goals to start with one tap, in the interface language: the same examples onboarding shows,
  /// with a local exam and a language that isn't the interface's own.
  private var examples: [String] {
    let language =
      Locale(identifier: Bundle.main.preferredLocalizations.first ?? "en")
      .language.languageCode?.identifier ?? "en"
    let spoken = language == "en" ? "es" : "en"
    let spokenName =
      Locale(identifier: language).localizedString(forLanguageCode: spoken) ?? spoken

    let exam =
      switch language {
      case "pt":
        String(
          localized: "Pass the ENEM", table: "Buddy",
          comment: "An example goal: Brazil's national exam")
      case "de":
        String(
          localized: "Pass the Abitur", table: "Buddy",
          comment: "An example goal: Germany's school-leaving exam")
      case "fr":
        String(
          localized: "Pass the bac", table: "Buddy",
          comment: "An example goal: France's school-leaving exam")
      case "es":
        String(
          localized: "Pass the PAU", table: "Buddy",
          comment: "An example goal: Spain's university entrance exam")
      default:
        String(
          localized: "Pass the SAT", table: "Buddy",
          comment: "An example goal: the US college entrance exam")
      }

    return [
      exam,
      String(
        localized: "Speak \(spokenName) for a job interview", table: "Buddy",
        comment: "An example goal; the argument is a language"),
      String(localized: "Understand quantum physics", table: "Buddy", comment: "An example goal"),
    ]
  }
}
