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
          Paperclip()
        } onAttached: { source in
          material.attach(source)
        }
      } else {
        Button {
          draft.showsSignUp.toggle()
        } label: {
          Paperclip()
        }
      }
    }
    // Only the paperclip, not the box's row it's in, opens it.
    .menuStyle(.button)
    .buttonStyle(.borderless)
    .disabled(!material.hasRoom)
  }
}

/// Its muted ink overrides the borderless style's disabled look, so it fades as ghost buttons do.
private struct Paperclip: View {
  @Environment(\.isEnabled) private var isEnabled

  var body: some View {
    Label {
      Text(
        "Add your material", tableName: "Onboarding",
        comment: "Opens the ways to add a file, text or a link to a goal")
    } icon: {
      Image(systemName: "paperclip")
    }
    .labelStyle(.iconOnly)
    .foregroundStyle(.mutedForeground)
    .opacity(isEnabled ? 1 : 0.5)
    .frame(minWidth: 44, minHeight: 44, alignment: .leading)
    .contentShape(.rect)
  }
}

/// What `GoalMaterialButton` added, as main's chips with what they need to say under them. One
/// row of the goal box's section, so it sits under the box as main's does.
struct GoalMaterialChips: View {
  @Binding var material: [AttachedSource]

  @Environment(OnboardingStore.self) private var onboarding
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    if !material.isEmpty {
      VStack(alignment: .leading, spacing: 12) {
        FlowLayout {
          ForEach(material) { source in
            MaterialChip(title: source.shownTitle, look: look(of: source)) {
              material.removeAll { $0.id == source.id }
            }
          }
        }

        if let fullLine {
          Text(fullLine)
            .typeStyle(.body)
            .foregroundStyle(.mutedForeground)
        }
      }
      .announcesStatus(fullLine)
      .listRowSeparator(.hidden)
      .listRowInsets(.bottom, 0)
      // Read only: a file still being read is followed until it's read, while its chip shows, and
      // checked again as soon as the learner comes back to it.
      .task(id: scenePhase == .active ? reading : []) {
        await follow(scenePhase == .active ? reading : [])
      }
    }
  }

  private var reading: [String] {
    material.filter { $0.readStatus == .reading && !$0.isUnavailable }.map(\.id)
  }

  private func follow(_ ids: [String]) async {
    while !ids.isEmpty {
      for id in ids {
        do {
          let status = try await onboarding.readStatus(sourceID: id)

          if status != .reading {
            material.update(id) { $0.readStatus = status }
          }
        } catch APIError.notFound {
          material.update(id) { $0.isUnavailable = true }
        } catch {
          // Asked again on the next beat.
        }
      }

      do {
        try await Task.sleep(for: .seconds(3))
      } catch {
        return
      }
    }
  }

  private func look(of source: AttachedSource) -> MaterialChip.Look {
    if source.isUnavailable {
      .gone
    } else if source.readStatus == .unreadable {
      .unreadable
    } else if source.readStatus == .reading {
      .reading
    } else {
      .ready
    }
  }

  /// Why the paperclip is off once the goal holds all the material it can use.
  private var fullLine: String? {
    material.hasRoom
      ? nil
      : String(
        localized: LocalizedStringResource(
          "\(AttachedSource.maxPerGoal) files is the most for one goal. Remove one to add another.",
          table: "Onboarding",
          comment:
            "Under the learner's attached files on Start when they've added as many as a goal can use, so the paperclip is off. {count} is that limit, like 5."
        ))
  }
}

/// Why attached material won't be read: files a goal found gone, to add again, and files with
/// nothing to read on them, in one line as main's. After the choices of what to do with it, not
/// under the chips: a read ends while the learner is choosing, and the line would push the choice
/// under their finger.
private struct MaterialUnreadSection: View {
  let material: [AttachedSource]

  var body: some View {
    if let message {
      Section {
        FailureLine(message: message)
          .listRowInsets(.top, 0)
      }
      // Main's line sits a small gap under the choices it follows.
      .listSectionSpacing(12)
    }
  }

  private var message: AttributedString? {
    let lines = [unavailableLine, unreadableLine].compactMap { $0 }.map {
      AttributedString(localized: $0)
    }

    return lines.reduce(nil) { joined, line in joined.map { $0 + " " + line } ?? line }
  }

  /// Names the one file a goal found gone; several are said together.
  private var unavailableLine: LocalizedStringResource? {
    let unavailable = material.filter(\.isUnavailable)

    guard let first = unavailable.first else {
      return nil
    }

    return unavailable.count == 1
      ? LocalizedStringResource(
        "We can't read “\(first.shownTitle)” anymore. Remove it and add it again.",
        table: "Onboarding",
        comment:
          "Under the learner's attached material when one item sent with their goal can't be read anymore. {title} is its name, like \"Cell cycle.pdf\"."
      )
      : LocalizedStringResource(
        "We can't read some of your files anymore. Remove them and add them again.",
        table: "Onboarding",
        comment:
          "Under the learner's attached material when several items sent with their goal can't be read anymore."
      )
  }

  /// Names the one file with nothing to read on it; several are said together, and their red chips
  /// show which.
  private var unreadableLine: LocalizedStringResource? {
    let unreadable = material.filter { $0.readStatus == .unreadable && !$0.isUnavailable }

    guard let first = unreadable.first else {
      return nil
    }

    return unreadable.count == 1
      ? .unreadableMaterial(title: first.shownTitle)
      : LocalizedStringResource(
        "We couldn't read these files. Try sharper photos or paste the text.",
        table: "Onboarding",
        comment:
          "Under the learner's attached material when nothing could be read on several of their files, like blurry photos of notes. The files are marked in red above."
      )
  }
}

/// What `GoalMaterialButton` is adding, and what to do with the material, after the goal box.
struct GoalMaterialSections: View {
  @Binding var material: [AttachedSource]
  @Binding var intent: MaterialIntent?
  @Binding var draft: MaterialDraft

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    Section {
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
              "Create a free account", tableName: "Onboarding",
              comment: "Opens sign-up to add material")
          }
        }
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
      // Main's question sits 24 under the chips: this gap and the header's own room above its text.
      .listSectionSpacing(12)

      MaterialUnreadSection(material: material)
    }
  }
}

/// One attached source, removed with its ✕ as main's chip is, or by swiping. One still being read
/// shows a spinner in place of its icon; one with nothing to read, or a goal found gone, takes
/// main's soft error look.
private struct MaterialChip: View {
  enum Look {
    case ready
    case reading
    case unreadable
    /// A goal found it gone.
    case gone
  }

  let title: String
  let look: Look
  let remove: () -> Void

  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: isAlert ? "exclamationmark.circle" : "doc.text")
        // The spinner takes the icon's place and size, so the chip doesn't move as it's read.
        .opacity(look == .reading ? 0 : 1)
        .overlay {
          if look == .reading {
            ProgressView()
              .controlSize(.mini)
          }
        }
        .accessibilityHidden(true)

      Text(title)
        .lineLimit(1)
        .accessibilityValue(status ?? Text(verbatim: ""), isEnabled: status != nil)

      Button(action: remove) {
        Image(systemName: "xmark")
          .frame(minWidth: 44, minHeight: 44)
          .contentShape(.rect)
          .accessibilityLabel(Text("Remove \(title)", tableName: "Onboarding"))
      }
      .buttonStyle(.plain)
      // Laid out as main's 28pt button, so the chip is main's height; its 44pt target reaches past
      // the chip.
      .padding(-8)
    }
    .typeStyle(.body)
    .foregroundStyle(isAlert ? .destructiveText : Color(.foreground))
    .padding(.leading, 12)
    .padding([.vertical, .trailing], 4)
    .background(
      isAlert ? Color.destructiveSoft : Color(.muted),
      in: .rect(cornerRadius: Radius.md))
  }

  /// Gone or with nothing to read on it, it takes main's soft error look.
  private var isAlert: Bool { look == .unreadable || look == .gone }

  private var status: Text? {
    switch look {
    case .ready:
      nil
    case .reading:
      Text(
        "Being read", tableName: "Onboarding",
        comment:
          "Read by screen readers after the name of an attached file, like a photo of notes, while it's still being read."
      )
    case .unreadable:
      Text(
        "Nothing on it could be read", tableName: "Onboarding",
        comment:
          "Read by screen readers after the name of an attached file, like a blurry photo of notes, where nothing could be read."
      )
    case .gone:
      Text(
        "Can't be read anymore", tableName: "Onboarding",
        comment:
          "Read by screen readers after the name of an attached file that's gone, so it must be added again."
      )
    }
  }
}

extension LocalizedStringResource {
  /// Under material with nothing to read on it, wherever it was added; pasted text has no title.
  nonisolated static func unreadableMaterial(title: String) -> LocalizedStringResource {
    let title =
      title.isEmpty
      ? String(
        localized: "Your text", table: "Onboarding", comment: "Pasted material without a title")
      : title

    return LocalizedStringResource(
      "We couldn't read “\(title)”. Try a sharper photo or paste the text.",
      table: "Onboarding",
      comment:
        "Under the learner's attached material when nothing could be read on one file, like a blurry photo of notes. {title} is its name, like \"Notes.jpg\"."
    )
  }
}

extension LearnerSummaryStore {
  /// Only accounts add material.
  fileprivate var canAttachMaterial: Bool {
    summary.value.map { !$0.identity.isAnonymous } ?? false
  }
}

extension AttachedSource {
  /// Core's `MAX_GOAL_SOURCES`: a goal is sent with this many at most.
  static let maxPerGoal = 5

  /// Pasted text has no title, so it's named as its chip is.
  var shownTitle: String {
    title.flatMap { $0.isEmpty ? nil : $0 }
      ?? String(
        localized: "Your text", table: "Onboarding", comment: "Pasted material without a title")
  }
}

extension [AttachedSource] {
  var hasRoom: Bool { count < AttachedSource.maxPerGoal }

  /// Marks the sources a goal found gone, by id, for the learner to remove.
  func marking(unavailable ids: [String]) -> [AttachedSource] {
    map { source in
      var source = source
      source.isUnavailable = ids.contains(source.id)
      return source
    }
  }

  fileprivate mutating func update(_ id: String, _ change: (inout AttachedSource) -> Void) {
    if let index = firstIndex(where: { $0.id == id }) {
      change(&self[index])
    }
  }

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
/// folding keeps it, and left as the screen's visit ends.
@MainActor
struct MaterialDraft {
  enum Pasting {
    case text
    case link
  }

  enum Attached {
    case source(AttachedSource)
    case failed(MaterialFailure)
  }

  var pasting: Pasting?
  var value = ""
  var showsSignUp = false
  /// Words sent while a source was still being added: they go with it once it's added, and not at
  /// all if adding it fails.
  var heldWords: String?
  let attaching = VisitRequest<Attached>()

  var isAdding: Bool { attaching.isRunning }

  var error: MaterialFailure? {
    if case .failed(let failure)? = attaching.outcome { failure } else { nil }
  }

  /// What the learner pasted stays; what was being added still saves, and shows nothing, and words
  /// held for it aren't sent.
  mutating func leave() {
    heldWords = nil
    attaching.leave()
  }

  static var adding: String {
    String(
      localized: "Adding your material…", table: "Onboarding", comment: "While material is added")
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
  /// Saves the added source where it's for; its throw shows as a failure to add.
  var save: (AttachedSource) async throws -> Void = { _ in }
  /// Once the source is added and saved, while the visit that added it lasts.
  let onAttached: (AttachedSource) -> Void

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
        $draft.add({ try await attach(file) }, save: save, then: onAttached)
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
  var save: (AttachedSource) async throws -> Void = { _ in }
  let onAttached: (AttachedSource) -> Void

  @Environment(OnboardingStore.self) private var onboarding

  var body: some View {
    if let pasting = draft.pasting {
      PasteMaterialRow(value: $draft.value, isLink: pasting == .link, isAdding: draft.isAdding) {
        value in
        $draft.add(
          {
            try await onboarding.attach(
              pasting == .link ? .link(value, goal: goal) : .text(value, goal: goal))
          }, save: save, then: onAttached)
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
      MaterialFailureView(failure: error, kind: .uploads)
    }
  }
}

extension Binding<MaterialDraft> {
  /// Reads one source, saves it and hands it on; a throw from either shows as a failure to add.
  @MainActor
  fileprivate func add(
    _ read: @escaping () async throws -> AttachedSource,
    save: @escaping (AttachedSource) async throws -> Void,
    then onAttached: @escaping (AttachedSource) -> Void
  ) {
    wrappedValue.attaching.run {
      do {
        let source = try await read()
        try await save(source)
        return .source(source)
      } catch is CancellationError {
        return nil
      } catch {
        return .failed(MaterialFailure(error) { MaterialDraft.message(for: $0) })
      }
    } then: { attached in
      if case .source(let source)? = attached {
        let held = wrappedValue.heldWords
        wrappedValue = MaterialDraft()
        wrappedValue.heldWords = held
        onAttached(source)
      }
    }
  }
}

extension MaterialDraft {
  nonisolated fileprivate static func message(for error: Error) -> LocalizedStringResource {
    switch error as? OnboardingError {
    case .limit(let limit) where limit.tier == "plus":
      LocalizedStringResource(
        "No more material today. More tomorrow.",
        table: "Onboarding", comment: "A subscriber added as much material as allowed today")
    case .limit:
      LocalizedStringResource(
        "No more material today. More tomorrow, or subscribe to keep going.",
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
    case .unreadable(let title):
      .unreadableMaterial(title: title)
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
  private static let linkLimit = 2_000
  private static let textLimit = 200_000

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
          FittedTextInput(text: $value, limit: Self.linkLimit) { text, selection in
            let example = Text(
              "https://… an article, a class page or a PDF", tableName: "Onboarding",
              comment: "Placeholder of the box for a material link")
            TextField(text: text, selection: selection, prompt: example.fieldPrompt()) { example }
              .keyboardType(.URL)
              .textContentType(.URL)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
              .onSubmit(add)
          }
        } else {
          MultilineTextField(
            text: $value, limit: Self.textLimit,
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
        BusyButton(isBusy: isAdding, icon: .create, action: add) {
          isLink
            ? Text("Add link", tableName: "Onboarding", comment: "Adds the pasted link")
            : Text("Add text", tableName: "Onboarding", comment: "Adds the pasted text")
        }
        .buttonStyle(.outline)
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
  /// The question sent and not answered yet. It's asked once nothing it's about is still being
  /// read; leaving drops it.
  @State private var pending: String?
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
            MaterialFailureView(
              failure: MaterialFailure(error) { Self.message(for: $0) }, kind: .questions)
          }
        }
      }

      if let pending {
        Section {
          Text(pending)
            .typeWeight(.medium)

          HStack(spacing: 8) {
            ProgressView()
            Text(Self.reading)
          }
          .foregroundStyle(.mutedForeground)
        }
      }
    }
    .announcesStatus(isAsking ? Self.reading : turns.last.flatMap(Self.spoken))
    .task(id: pending) {
      if let pending {
        await answer(pending)
      }
    }
    .safeAreaInset(edge: .bottom) {
      HStack(alignment: .bottom, spacing: 8) {
        MultilineTextField(
          text: $question, limit: Self.maxLength,
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
        .buttonStyle(.mainAction.icon)
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

  private var isAsking: Bool { pending != nil }

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
    pending = asked
  }

  /// Waits while the material is still being read, then asks. Material still being read when it
  /// asks makes it wait again.
  private func answer(_ asked: String) async {
    var reading = sources.filter { $0.readStatus == .reading }.map(\.id)

    while true {
      guard await settle(reading) else {
        return
      }

      do {
        let answer = try await onboarding.askMaterial(
          question: asked, sourceIDs: sources.map(\.id))
        finish(asked, .success(answer))
        return
      } catch is CancellationError {
        return
      } catch OnboardingError.materialReading {
        reading = sources.map(\.id)

        guard await beat() else {
          return
        }
      } catch {
        finish(asked, .failure(error))
        return
      }
    }
  }

  /// Until none of these is still being read; false once the screen is left.
  private func settle(_ ids: [String]) async -> Bool {
    var waiting = ids

    while !waiting.isEmpty {
      var still: [String] = []

      for id in waiting {
        do {
          if try await onboarding.readStatus(sourceID: id) == .reading {
            still.append(id)
          }
        } catch APIError.notFound {
          // Gone: nothing left to wait for, and the answer leaves it out.
        } catch {
          still.append(id)
        }
      }

      waiting = still

      if !waiting.isEmpty {
        guard await beat() else {
          return false
        }
      }
    }

    return !Task.isCancelled
  }

  /// The wait between checks; false once the screen is left.
  private func beat() async -> Bool {
    do {
      try await Task.sleep(for: .seconds(3))
      return true
    } catch {
      return false
    }
  }

  private func finish(_ asked: String, _ answer: Result<MaterialAnswer, Error>) {
    guard !Task.isCancelled else {
      return
    }

    turns.append(Turn(question: asked, answer: answer))
    pending = nil
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
        "No more questions today. More tomorrow.", table: "Onboarding",
        comment: "A subscriber asked as many material questions as allowed today")
    case .limit:
      LocalizedStringResource(
        "No more questions today. More tomorrow, or subscribe to keep going.",
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

/// Why material couldn't be added or asked about. A monthly cap is the shared notice, which follows
/// its day while the screen is open; anything else is one line.
enum MaterialFailure: Equatable {
  case notice(HelpLimit)
  case line(LocalizedStringResource)

  init(_ error: Error, line: (Error) -> LocalizedStringResource) {
    if case .limit(let limit) = error as? OnboardingError, limit.help.isMonthly {
      self = .notice(limit.help)
    } else {
      self = .line(line(error))
    }
  }
}

struct MaterialFailureView: View {
  let failure: MaterialFailure
  let kind: HelpLimit.Kind

  var body: some View {
    switch failure {
    case .notice(let limit):
      LimitNotice(limit: limit, kind: kind)
    case .line(let message):
      FailureLine(message: message)
    }
  }
}
