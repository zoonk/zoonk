import SwiftUI
import UniformTypeIdentifiers

enum MaterialIntent: Hashable {
  case exam
  case understand
  case questions
}

/// Main's paperclip inside the goal box: the ways to add material for an account, or how to get
/// one for a guest or a visitor, which `GoalMaterialSections` shows after the box.
struct GoalMaterialButton: View {
  @Binding var material: [AttachedSource]
  @Binding var draft: MaterialDraft

  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    Group {
      if learner.canAttachMaterial {
        MaterialAttachMenu(
          draft: $draft,
          header: Text(
            "Your plan and lessons will use it.", tableName: "Onboarding",
            comment: "Over the ways to add material to a goal, in their menu")
        ) {
          paperclip
        } onAttached: { source in
          material.attach(source)
        }
      } else {
        Button {
          draft.showsSignUp.toggle()
        } label: {
          paperclip
        }
      }
    }
    // Only the paperclip, not the box's row it's in, opens it.
    .menuStyle(.button)
    .buttonStyle(.borderless)
  }

  private var paperclip: some View {
    Label {
      Text(
        "Add your material", tableName: "Onboarding",
        comment: "Opens the ways to add a file, text or a link to a goal")
    } icon: {
      Image(systemName: "paperclip")
    }
    .labelStyle(.iconOnly)
    .foregroundStyle(.mutedForeground)
    .frame(minWidth: 44, minHeight: 44)
    .contentShape(.rect)
  }
}

/// What `GoalMaterialButton` added and is adding, after the goal box.
struct GoalMaterialSections: View {
  @Binding var material: [AttachedSource]
  @Binding var intent: MaterialIntent?
  @Binding var draft: MaterialDraft

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

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

      if learner.canAttachMaterial {
        MaterialAttachProgress(draft: $draft) { source in
          material.attach(source)
        }
      } else if draft.showsSignUp {
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "Study your own material", tableName: "Onboarding",
            comment: "Title of the way a guest gets an account to add material"
          )
          .typeStyle(.body.weight(.semibold))

          Text(
            "Create a free account to add a PDF, a photo of your notes or any text to your goal.",
            tableName: "Onboarding", comment: "Why a guest can't add material yet"
          )
          .foregroundStyle(.mutedForeground)

          Button {
            router.present(.signIn)
          } label: {
            Text(
              "Create an account", tableName: "Onboarding",
              comment: "Opens sign-up to add material")
          }
        }
      }
    } header: {
      if !material.isEmpty {
        SectionTitle(
          Text(
            "Your material", tableName: "Onboarding",
            comment: "Header over the material attached to a goal"))
      }
    }

    if !material.isEmpty {
      Section {
        ChoiceRows(
          choices: [
            .init(
              value: MaterialIntent.exam,
              label: String(
                localized: "Prepare for an exam", table: "Onboarding",
                comment: "Material intent: the learner wants to prepare for an exam on it"),
              detail: Text(
                "Give a date and we'll plan up to it", tableName: "Onboarding",
                comment: "Under the exam material intent")),
            .init(
              value: .understand,
              label: String(
                localized: "Understand this material", table: "Onboarding",
                comment: "Material intent: lessons that teach it"),
              detail: Text(
                "Short lessons, in the right order", tableName: "Onboarding",
                comment: "Under the understand material intent")),
            .init(
              value: .questions,
              label: String(
                localized: "Ask questions", table: "Onboarding",
                comment: "Material intent: answers from it"),
              detail: Text(
                "Answers show the page they came from", tableName: "Onboarding",
                comment: "Under the questions material intent")),
          ],
          picked: intent
        ) { intent = $0 }
      } header: {
        SectionTitle(
          Text(
            "What do you want to do?", tableName: "Onboarding",
            comment: "Header over what to do with attached material"))
      }
    }
  }

  private func title(of source: AttachedSource) -> String {
    source.title.flatMap { $0.isEmpty ? nil : $0 }
      ?? String(
        localized: "Your text", table: "Onboarding", comment: "Pasted material without a title")
  }
}

extension LearnerSummaryStore {
  /// Only accounts add material.
  fileprivate var canAttachMaterial: Bool {
    summary.value.map { !$0.identity.isAnonymous } ?? false
  }
}

extension [AttachedSource] {
  /// The same source added again replaces itself at the end.
  fileprivate mutating func attach(_ source: AttachedSource) {
    self = filter { $0.id != source.id } + [source]
  }
}

/// What the uploads route reads.
private let readableMaterialTypes: [UTType] = [
  .pdf, .plainText, .jpeg, .png, .webP,
  UTType("org.openxmlformats.wordprocessingml.document"),
  UTType("org.openxmlformats.presentationml.presentation"),
  UTType(filenameExtension: "md"),
].compactMap { $0 }

/// What the learner is adding as material: text or a link being pasted, a source being read and
/// what failed, or for a guest, how to get an account. Kept by the screen above its panes, so
/// folding keeps it.
struct MaterialDraft {
  enum Pasting {
    case text
    case link
  }

  var pasting: Pasting?
  var value = ""
  var isAdding = false
  var error: LocalizedStringResource?
  var showsSignUp = false

  static var adding: String {
    String(
      localized: "Adding your material…", table: "Onboarding", comment: "While material is added")
  }
}

/// A file, pasted text or a link, added as one source: the ways to add one, then what's being
/// added. Only accounts add material, so callers show it to them alone.
struct MaterialAttachControls<Label: View>: View {
  var goal: (id: String, language: String)?
  @Binding var draft: MaterialDraft
  @ViewBuilder let label: Label
  let onAttached: (AttachedSource) async throws -> Void

  var body: some View {
    MaterialAttachMenu(goal: goal, draft: $draft, label: { label }, onAttached: onAttached)
    MaterialAttachProgress(goal: goal, draft: $draft, onAttached: onAttached)
  }
}

/// The ways to add a source: a file, pasted text or a link.
struct MaterialAttachMenu<Label: View>: View {
  /// A goal's material is read in its language and kept with it; onboarding's has no goal yet.
  var goal: (id: String, language: String)?
  @Binding var draft: MaterialDraft
  /// Over the ways, what the material is for.
  var header: Text?
  @ViewBuilder let label: Label
  /// Its throw shows as a failure to add.
  let onAttached: (AttachedSource) async throws -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var isImporting = false

  var body: some View {
    Menu {
      if let header {
        Section {
          ways
        } header: {
          header
        }
      } else {
        ways
      }
    } label: {
      label
    }
    .disabled(draft.isAdding)
    .announcesStatus(draft.isAdding ? MaterialDraft.adding : nil)
    .fileImporter(isPresented: $isImporting, allowedContentTypes: readableMaterialTypes) { result in
      if case .success(let file) = result {
        $draft.add({ try await attach(file) }, then: onAttached)
      }
    }
  }

  @ViewBuilder private var ways: some View {
    Button {
      isImporting = true
    } label: {
      SwiftUI.Label {
        Text("Upload a file", tableName: "Onboarding", comment: "Adds a file as material")
      } icon: {
        Image(systemName: "arrow.up.doc")
      }
    }

    Button {
      draft.pasting = .text
      draft.value = ""
    } label: {
      SwiftUI.Label {
        Text("Paste text", tableName: "Onboarding", comment: "Adds pasted text as material")
      } icon: {
        Image(systemName: "doc.plaintext")
      }
    }

    Button {
      draft.pasting = .link
      draft.value = ""
    } label: {
      SwiftUI.Label {
        Text("Paste a link", tableName: "Onboarding", comment: "Adds a link as material")
      } icon: {
        Image(systemName: "link")
      }
    }
  }

  private func attach(_ file: URL) async throws -> AttachedSource {
    let isScoped = file.startAccessingSecurityScopedResource()
    defer {
      if isScoped {
        file.stopAccessingSecurityScopedResource()
      }
    }

    return try await onboarding.attachFile(file, goal: goal)
  }
}

/// What `MaterialAttachMenu` started: the text or link being pasted, the source being read and
/// what failed.
struct MaterialAttachProgress: View {
  var goal: (id: String, language: String)?
  @Binding var draft: MaterialDraft
  let onAttached: (AttachedSource) async throws -> Void

  @Environment(OnboardingStore.self) private var onboarding

  var body: some View {
    if let pasting = draft.pasting {
      PasteMaterialRow(value: $draft.value, isLink: pasting == .link, isAdding: draft.isAdding) {
        value in
        $draft.add(
          {
            try await onboarding.attach(
              pasting == .link ? .link(value, goal: goal) : .text(value, goal: goal))
          }, then: onAttached)
      } onCancel: {
        draft.pasting = nil
        draft.value = ""
      }
    }

    if draft.isAdding {
      HStack(spacing: 8) {
        ProgressView()
        Text(MaterialDraft.adding)
      }
      .foregroundStyle(.mutedForeground)
    }

    if let error = draft.error {
      FailureLine(message: error)
    }
  }
}

extension Binding<MaterialDraft> {
  /// Reads one source and hands it on; a throw from either shows as a failure to add.
  @MainActor
  fileprivate func add(
    _ read: @escaping () async throws -> AttachedSource,
    then onAttached: @escaping (AttachedSource) async throws -> Void
  ) {
    wrappedValue.isAdding = true
    wrappedValue.error = nil

    Task {
      defer { wrappedValue.isAdding = false }

      do {
        try await onAttached(read())
        wrappedValue = MaterialDraft()
      } catch is CancellationError {
      } catch {
        wrappedValue.error = MaterialDraft.message(for: error)
      }
    }
  }
}

extension MaterialDraft {
  fileprivate static func message(for error: Error) -> LocalizedStringResource {
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
    case .alreadyRead:
      LocalizedStringResource(
        "We already read this document. Upload a different one.", table: "Onboarding",
        comment: "The learner sent again a document research already read for an earlier ask")
    default:
      LocalizedStringResource(
        "We couldn't add that. Try again in a moment.", table: "Onboarding",
        comment: "Adding material failed")
    }
  }
}

private struct PasteMaterialRow: View {
  @Binding var value: String
  let isLink: Bool
  let isAdding: Bool
  let onAdd: (String) -> Void
  let onCancel: () -> Void

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
          MultilineTextField(
            text: $value,
            prompt: Text(
              "Paste the syllabus, your notes or a chapter", tableName: "Onboarding",
              comment: "Placeholder of the box for pasted material"),
            label: Text(
              "Your text", tableName: "Onboarding", comment: "Pasted material without a title")
          )
          .lineLimit(3...12)
        }
      }
      .focused($isFocused)

      ButtonRow {
        BusyButton(isBusy: isAdding, action: add) {
          isLink
            ? Text("Add link", tableName: "Onboarding", comment: "Adds the pasted link")
            : Text("Add text", tableName: "Onboarding", comment: "Adds the pasted text")
        }
        .buttonStyle(.mainAction)
        .disabled(trimmed.isEmpty)

        Button(role: .cancel, action: onCancel) {
          Text("Cancel", tableName: "Onboarding", comment: "Closes the box for pasted material")
        }
        .buttonStyle(.outline)
      }
      .controlSize(.small)
    }
    .keepsOffFold()
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
    ZoonkList {
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
            .typeWeight(.medium)

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
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
            }
          case .failure(let error):
            FailureLine(message: Self.message(for: error))
          }
        }
      }

      if isAsking {
        HStack(spacing: 8) {
          ProgressView()
          Text(Self.reading)
        }
        .foregroundStyle(.mutedForeground)
      }
    }
    .announcesStatus(isAsking ? Self.reading : turns.last.flatMap(Self.spoken))
    .safeAreaInset(edge: .bottom) {
      HStack(alignment: .bottom, spacing: 8) {
        MultilineTextField(
          text: $question,
          prompt: Text(
            "E.g., why does glycolysis net only 2 ATP?", tableName: "Onboarding",
            comment: "Placeholder of the box for a question about the learner's material"),
          label: Text(
            "Your question", tableName: "Onboarding",
            comment: "The box for a question about the learner's material"),
          onSubmit: ask
        )
        .lineLimit(1...5)
        .focused($isFocused)
        .submitLabel(.send)
        .onChange(of: question) { _, value in
          if value.count > Self.maxLength {
            question = String(value.prefix(Self.maxLength))
          }
        }
        .padding(.vertical, 10)
        .padding(.leading, 10)

        BusyButton(isBusy: isAsking, action: ask) {
          Label {
            Text("Ask", tableName: "Onboarding", comment: "Sends a question about the material")
          } icon: {
            Image(systemName: "arrow.up")
          }
          .labelStyle(.iconOnly)
        }
        .buttonStyle(.mainAction)
        .buttonBorderShape(.circle)
        .controlSize(.large)
        .disabled(trimmed.isEmpty)
      }
      .padding(6)
      .inputPanel(isFocused: isFocused)
      .padding()
      .keepsOffFold()
      .background(.bar)
    }
    .onAppear { isFocused = true }
  }

  private var trimmed: String {
    question.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static var reading: String {
    String(
      localized: "Reading your material…", table: "Onboarding",
      comment: "While a question about the learner's material is answered")
  }

  /// A failed answer is a `FailureLine`, which reads itself out.
  private static func spoken(_ turn: Turn) -> String? {
    switch turn.answer {
    case .success(let answer): answer.answer
    case .failure: nil
    }
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

    return CitationLabel.material(title: title, page: citation.page, unit: citation.unit)
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
