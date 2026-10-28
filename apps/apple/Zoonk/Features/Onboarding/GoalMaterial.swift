import SwiftUI
import UniformTypeIdentifiers

enum MaterialIntent: Hashable {
  case exam
  case understand
  case questions
}

/// Only accounts can add material, so guests and visitors are told how to create one.
struct GoalMaterialSections: View {
  @Binding var material: [AttachedSource]
  @Binding var intent: MaterialIntent?

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(OnboardingStore.self) private var onboarding
  @State private var isImporting = false
  @State private var pasting: Pasting?
  @State private var isAdding = false
  @State private var error: LocalizedStringResource?
  @State private var showsSignUp = false

  private enum Pasting: Identifiable {
    case text
    case link

    var id: Self { self }
  }

  /// What the uploads route reads.
  private static let readableTypes: [UTType] = [
    .pdf, .plainText, .jpeg, .png, .webP,
    UTType("org.openxmlformats.wordprocessingml.document"),
    UTType("org.openxmlformats.presentationml.presentation"),
    UTType(filenameExtension: "md"),
  ].compactMap { $0 }

  var body: some View {
    Section {
      ForEach(material) { source in
        Label {
          Text(title(of: source))
            .lineLimit(1)
        } icon: {
          Image(systemName: "doc.text")
        }
      }
      .onDelete { material.remove(atOffsets: $0) }

      if canAttach {
        Menu {
          Button {
            isImporting = true
          } label: {
            Label {
              Text("Upload a file", tableName: "Onboarding", comment: "Adds a file as material")
            } icon: {
              Image(systemName: "arrow.up.doc")
            }
          }

          Button {
            pasting = .text
          } label: {
            Label {
              Text("Paste text", tableName: "Onboarding", comment: "Adds pasted text as material")
            } icon: {
              Image(systemName: "doc.plaintext")
            }
          }

          Button {
            pasting = .link
          } label: {
            Label {
              Text("Paste a link", tableName: "Onboarding", comment: "Adds a link as material")
            } icon: {
              Image(systemName: "link")
            }
          }
        } label: {
          paperclipLabel
        }
        .disabled(isAdding)
        .fileImporter(isPresented: $isImporting, allowedContentTypes: Self.readableTypes) {
          result in
          if case .success(let file) = result {
            add { try await attach(file) }
          }
        }

        if let pasting {
          PasteMaterialRow(isLink: pasting == .link, isAdding: isAdding) { value in
            add {
              try await onboarding.attach(pasting == .link ? .link(value) : .text(value))
            }
          } onCancel: {
            self.pasting = nil
          }
        }

        if isAdding {
          HStack(spacing: 8) {
            ProgressView()
            Text(
              "Adding your material…", tableName: "Onboarding",
              comment: "While material is added")
          }
          .foregroundStyle(.secondary)
        }

        if let error {
          Text(error)
            .foregroundStyle(.destructive)
        }
      } else if showsSignUp {
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "Study your own material", tableName: "Onboarding",
            comment: "Title of the way a guest gets an account to add material"
          )
          .font(.headline)

          Text(
            "Create a free account to add a PDF, a photo of your notes or any text to your goal.",
            tableName: "Onboarding", comment: "Why a guest can't add material yet"
          )
          .foregroundStyle(.secondary)

          Button {
            router.present(.signIn)
          } label: {
            Text(
              "Create an account", tableName: "Onboarding",
              comment: "Opens sign-up to add material")
          }
        }
      } else {
        Button {
          showsSignUp = true
        } label: {
          paperclipLabel
        }
      }
    } header: {
      if !material.isEmpty {
        Text(
          "Your material", tableName: "Onboarding",
          comment: "Header over the material attached to a goal")
      }
    } footer: {
      if canAttach, material.isEmpty {
        Text(
          "Your plan and lessons will use it.", tableName: "Onboarding",
          comment: "Under the way to add material")
      }
    }

    if !material.isEmpty {
      Section {
        ChoiceRows(
          choices: [
            .init(
              value: MaterialIntent.exam,
              label: Text(
                "Prepare for an exam", tableName: "Onboarding",
                comment: "Material intent: an exam on it"),
              detail: Text(
                "Give a date and we'll plan up to it", tableName: "Onboarding",
                comment: "Under the exam material intent")),
            .init(
              value: .understand,
              label: Text(
                "Understand this material", tableName: "Onboarding",
                comment: "Material intent: lessons that teach it"),
              detail: Text(
                "Short lessons, in the right order", tableName: "Onboarding",
                comment: "Under the understand material intent")),
            .init(
              value: .questions,
              label: Text(
                "Ask questions", tableName: "Onboarding",
                comment: "Material intent: answers from it"),
              detail: Text(
                "Answers show the page they came from", tableName: "Onboarding",
                comment: "Under the questions material intent")),
          ],
          picked: intent
        ) { intent = $0 }
      } header: {
        Text(
          "What do you want to do?", tableName: "Onboarding",
          comment: "Header over what to do with attached material")
      }
    }
  }

  private var paperclipLabel: some View {
    Label {
      Text(
        "Add your material", tableName: "Onboarding",
        comment: "Opens the ways to add a file, text or a link to a goal")
    } icon: {
      Image(systemName: "paperclip")
    }
  }

  private var canAttach: Bool {
    learner.summary.value.map { !$0.identity.isAnonymous } ?? false
  }

  private func title(of source: AttachedSource) -> String {
    source.title.flatMap { $0.isEmpty ? nil : $0 }
      ?? String(
        localized: "Your text", table: "Onboarding", comment: "Pasted material without a title")
  }

  private func attach(_ file: URL) async throws -> AttachedSource {
    let isScoped = file.startAccessingSecurityScopedResource()
    defer {
      if isScoped {
        file.stopAccessingSecurityScopedResource()
      }
    }

    return try await onboarding.attachFile(file)
  }

  private func add(_ attach: @escaping () async throws -> AttachedSource) {
    isAdding = true
    error = nil

    Task {
      defer { isAdding = false }

      do {
        let source = try await attach()
        material = material.filter { $0.id != source.id } + [source]
        pasting = nil
      } catch is CancellationError {
      } catch {
        self.error = Self.message(for: error)
      }
    }
  }

  private static func message(for error: Error) -> LocalizedStringResource {
    switch error as? OnboardingError {
    case .limit(let limit) where limit.tier == "plus":
      LocalizedStringResource(
        "You've added as much material as your plan allows today. Try again tomorrow.",
        table: "Onboarding", comment: "A Plus learner added as much material as allowed today")
    case .limit(let limit) where limit.period == "month":
      LocalizedStringResource(
        "You've added as much material as the free plan allows this month. Try again next month, or get Plus to keep going now.",
        table: "Onboarding", comment: "A free learner added as much material as allowed this month")
    case .limit:
      LocalizedStringResource(
        "You've added as much material as the free plan allows today. Try again tomorrow, or get Plus to keep going now.",
        table: "Onboarding", comment: "A free learner added as much material as allowed today")
    case .slowDown:
      LocalizedStringResource(
        "You're adding material quickly. Try again in a few minutes.", table: "Onboarding",
        comment: "Material is added too quickly")
    case .unsupported:
      LocalizedStringResource(
        "We can't read this file. Try a PDF, a photo, Word, PowerPoint or text.",
        table: "Onboarding", comment: "A file of a kind that can't be read")
    case .signUpRequired:
      LocalizedStringResource(
        "Create an account to add your own material.", table: "Onboarding",
        comment: "Only accounts add material")
    default:
      LocalizedStringResource(
        "We couldn't add that. Try again in a moment.", table: "Onboarding",
        comment: "Adding material failed")
    }
  }
}

private struct PasteMaterialRow: View {
  let isLink: Bool
  let isAdding: Bool
  let onAdd: (String) -> Void
  let onCancel: () -> Void

  @State private var value = ""
  @FocusState private var isFocused: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Group {
        if isLink {
          TextField(text: $value) {
            Text(
              "https://… an article, a class page or a PDF", tableName: "Onboarding",
              comment: "Placeholder of the box for a material link")
          }
          .keyboardType(.URL)
          .textContentType(.URL)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .onSubmit(add)
        } else {
          TextField(text: $value, axis: .vertical) {
            Text(
              "Paste the syllabus, your notes or a chapter", tableName: "Onboarding",
              comment: "Placeholder of the box for pasted material")
          }
          .lineLimit(3...12)
        }
      }
      .focused($isFocused)

      HStack {
        Button(action: add) {
          isLink
            ? Text("Add link", tableName: "Onboarding", comment: "Adds the pasted link")
            : Text("Add text", tableName: "Onboarding", comment: "Adds the pasted text")
        }
        .buttonStyle(.borderedProminent)
        .disabled(trimmed.isEmpty || isAdding)

        Button(role: .cancel, action: onCancel) {
          Text("Cancel", tableName: "Onboarding", comment: "Closes the box for pasted material")
        }
        .buttonStyle(.bordered)
      }
      .controlSize(.small)
    }
    .onAppear { isFocused = true }
  }

  private var trimmed: String {
    value.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private func add() {
    guard !trimmed.isEmpty else {
      return
    }

    onAdd(trimmed)
  }
}

struct MaterialQuestionsView: View {
  let sources: [AttachedSource]

  @Environment(OnboardingStore.self) private var onboarding
  @State private var question = ""
  @State private var turns: [Turn] = []
  @State private var isAsking = false
  @FocusState private var isFocused: Bool

  private struct Turn: Identifiable {
    let id = UUID()
    let question: String
    let answer: Result<MaterialAnswer, Error>
  }

  private static let maxLength = 500

  var body: some View {
    List {
      StepHeader(
        title: Text(
          "Ask about your material", tableName: "Onboarding",
          comment: "Title of questions about the learner's material"),
        description: Text(
          "Answers come from your pages and show where they came from.", tableName: "Onboarding",
          comment: "Under the title of questions about the learner's material"))

      ForEach(turns) { turn in
        Section {
          Text(turn.question)
            .fontWeight(.medium)

          switch turn.answer {
          case .success(let answer):
            Text(answer.answer)
              .textSelection(.enabled)

            ForEach(answer.citations, id: \.self) { citation in
              Label {
                Text(label(citation))
              } icon: {
                Image(systemName: "doc.text")
              }
              .font(.footnote)
              .foregroundStyle(.secondary)
            }
          case .failure(let error):
            Text(Self.message(for: error))
              .foregroundStyle(.destructive)
          }
        }
      }

      if isAsking {
        HStack(spacing: 8) {
          ProgressView()
          Text(
            "Reading your material…", tableName: "Onboarding",
            comment: "While a question about the learner's material is answered")
        }
        .foregroundStyle(.secondary)
      }
    }
    .safeAreaInset(edge: .bottom) {
      HStack(alignment: .bottom, spacing: 8) {
        TextField(text: $question, axis: .vertical) {
          Text(
            "E.g., why does glycolysis net only 2 ATP?", tableName: "Onboarding",
            comment: "Placeholder of the box for a question about the learner's material")
        }
        .lineLimit(1...5)
        .focused($isFocused)
        .submitLabel(.send)
        .onSubmit(ask)
        .onChange(of: question) { _, value in
          if value.count > Self.maxLength {
            question = String(value.prefix(Self.maxLength))
          }

          if value.hasSuffix("\n") {
            question = String(value.dropLast())
            ask()
          }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(.background, in: .rect(cornerRadius: 22))

        Button(action: ask) {
          Label {
            Text("Ask", tableName: "Onboarding", comment: "Sends a question about the material")
          } icon: {
            Image(systemName: "arrow.up")
          }
          .labelStyle(.iconOnly)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.circle)
        .controlSize(.large)
        .disabled(trimmed.isEmpty || isAsking)
      }
      .padding()
      .keepsOffFold()
      .background(.bar)
    }
    .onAppear { isFocused = true }
  }

  private var trimmed: String {
    question.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private func ask() {
    let asked = trimmed

    guard !asked.isEmpty, !isAsking else {
      return
    }

    question = ""
    isAsking = true

    Task {
      defer { isAsking = false }

      do {
        let answer = try await onboarding.askMaterial(
          question: asked, sourceIDs: sources.map(\.id))
        turns.append(Turn(question: asked, answer: .success(answer)))
      } catch is CancellationError {
      } catch {
        turns.append(Turn(question: asked, answer: .failure(error)))
      }
    }
  }

  /// Pasted text has no title, so it's named as its chip is.
  private func label(_ citation: MaterialAnswer.Citation) -> String {
    let title =
      citation.title.isEmpty
      ? String(
        localized: "Your text", table: "Onboarding", comment: "Pasted material without a title")
      : citation.title

    guard let page = citation.page else {
      return title
    }

    return citation.unit == "slide"
      ? String(
        localized: "\(title), slide \(String(page))", table: "Onboarding",
        comment: "Where an answer came from: a deck's slide")
      : String(
        localized: "\(title), page \(String(page))", table: "Onboarding",
        comment: "Where an answer came from: a document's page")
  }

  private static func message(for error: Error) -> LocalizedStringResource {
    switch error as? OnboardingError {
    case .limit(let limit) where limit.tier == "plus":
      LocalizedStringResource(
        "You've asked as many questions as your plan allows today.", table: "Onboarding",
        comment: "A Plus learner asked as many material questions as allowed today")
    case .limit(let limit) where limit.period == "month":
      LocalizedStringResource(
        "You've asked as many questions as the free plan allows this month. Ask again next month, or get Plus to keep going now.",
        table: "Onboarding",
        comment: "A free learner asked as many material questions as allowed this month")
    case .limit:
      LocalizedStringResource(
        "You've asked as many questions as the free plan allows today. Ask again tomorrow, or get Plus to keep going now.",
        table: "Onboarding",
        comment: "A free learner asked as many material questions as allowed today")
    case .slowDown:
      LocalizedStringResource(
        "You're asking quickly. Try again in a few minutes.", table: "Onboarding",
        comment: "Material questions are asked too quickly")
    case .signUpRequired:
      LocalizedStringResource(
        "Create an account to ask about your material.", table: "Onboarding",
        comment: "Only accounts ask about material")
    default:
      LocalizedStringResource(
        "We couldn't answer that. Try again in a moment.", table: "Onboarding",
        comment: "Answering a material question failed")
    }
  }
}
