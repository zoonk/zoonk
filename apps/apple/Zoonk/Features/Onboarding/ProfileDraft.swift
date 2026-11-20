import Foundation

typealias ProfileQuestion = Components.Schemas.ProfileQuestion
typealias ProfileQuestionView = Components.Schemas.ProfileQuestionView
typealias ProfileQuestions = Components.Schemas.ProfileQuestions

extension ProfileQuestion {
  /// The questions about the learner's life, which become memory and need it on.
  var isBiography: Bool {
    switch self {
    case .addressForm, .conditions, .learningSupport: false
    case .work, .tools, .studies, .watch, .listen, .play, .read, .activities: true
    }
  }
}

extension Components.Schemas.OnboardingStep {
  var profileQuestion: ProfileQuestion? {
    ProfileQuestion(rawValue: rawValue)
  }
}

/// One About you screen's answer as the learner makes it: built from what core saved, and turned
/// back into the answer core takes, every field included.
struct ProfileDraft: Equatable {
  /// The row that declines a pick-one question instead of answering it. A question with several
  /// picks declines by saving none.
  enum Decline: Equatable {
    case ratherNotSay
  }

  static let noSoundEffects = "noSoundEffects"
  static let otherOption = "other"
  /// Core's limit on favorites, as saving joins them.
  static let favoritesLimit = 120

  let question: ProfileQuestion
  /// In pick order, which studies' subject fields follow. For `work`, the one status; for
  /// `addressForm`, the one form.
  private(set) var picks: [String]
  private(set) var decline: Decline?
  /// Favorites, the job, the `other` condition's note or the support note. Typing answers the
  /// question, as a pick does. For tools, what's in the field and not yet added.
  var text: String {
    didSet {
      if !text.isEmpty {
        decline = nil
      }
    }
  }
  /// Studies: each picked field's course or subject.
  var subjects: [String: String]
  /// Tools: each tool typed and added, a chip under the field.
  private(set) var typedTools: [String]
  /// Tools: the offered chips' ids by their names in lowercase, so typing one picks it.
  private let offeredTools: [String: String]

  /// A declined question opens on the row that declined it; conditions have none, so they open
  /// empty. With memory off, the support note is hidden, so it's left out of the answer and its
  /// saved fact stays as it is.
  init(_ view: ProfileQuestionView, memoryEnabled: Bool = true) {
    let isTools = view.id == .tools

    question = view.id
    picks = view.saved.picks
    text = isTools || (view.id == .learningSupport && !memoryEnabled) ? "" : view.saved.text
    subjects = [:]
    typedTools = isTools ? Self.favorites(in: view.saved.text) : []
    offeredTools =
      isTools
      ? Dictionary(
        view.options.map { ($0.label.lowercased(), $0.id) }, uniquingKeysWith: { first, _ in first }
      )
      : [:]

    for study in view.saved.studies {
      picks.append(study.field)
      subjects[study.field] = study.subject ?? ""
    }

    decline =
      if view.status == .declined && picks.isEmpty && text.isEmpty {
        switch view.id {
        case .addressForm, .work: .ratherNotSay
        default: nil
        }
      } else {
        nil
      }
  }

  mutating func toggle(_ id: String) {
    decline = nil

    if let index = picks.firstIndex(of: id) {
      picks.remove(at: index)
      return
    }

    if question == .work || question == .addressForm {
      picks = [id]
      return
    }

    picks.append(id)
  }

  /// Tools, once the field shows what was typed: a comma or a semicolon adds what's before it, and
  /// the field keeps no more than the favorites' limit leaves room for. It runs after the field
  /// shows the typed text, since a field whose value comes back unchanged keeps what it shows.
  mutating func settleToolText() {
    if text.contains(where: Self.separators.contains) {
      addTypedTools()
    } else if text.count > toolRoom {
      text = String(text.prefix(toolRoom))
    }
  }

  /// Tools: what's in the field becomes chips and the field empties. A name an offered chip has
  /// picks that chip, and a name already added is left out.
  mutating func addTypedTools() {
    for name in Self.favorites(in: text) {
      if let id = offeredTools[name.lowercased()] {
        if !picks.contains(id) {
          picks.append(id)
        }
      } else if !typedTools.contains(where: { $0.lowercased() == name.lowercased() }),
        toolRoom > 0
      {
        typedTools.append(String(name.prefix(toolRoom)))
      }
    }

    text = ""
  }

  mutating func removeTypedTool(_ name: String) {
    typedTools.removeAll { $0 == name }
  }

  /// What one more typed tool can hold, after the ones added and the ", " before it.
  private var toolRoom: Int {
    max(
      0,
      Self.favoritesLimit
        - (typedTools.isEmpty ? 0 : typedTools.joined(separator: ", ").count + 2))
  }

  /// Core's `splitProfileFavorites`: favorites as saved text holds them, each once.
  static func favorites(in text: String) -> [String] {
    var seen = Set<String>()

    return text.split(whereSeparator: separators.contains).compactMap { item in
      let name = trimmed(String(item))
      return !name.isEmpty && seen.insert(name.lowercased()).inserted ? name : nil
    }
  }

  /// Core's favorites separators. A Character holds "\r\n" as one, so it's listed too.
  private static let separators: Set<Character> = [",", ";", "、", "，", "\n", "\r", "\r\n"]

  /// Picking a declining row clears everything else, as any other pick clears it.
  mutating func toggle(_ decline: Decline) {
    if self.decline == decline {
      self.decline = nil
    } else {
      self = declining(decline)
    }
  }

  /// This question declined, whatever was picked or typed.
  func declining(_ decline: Decline) -> ProfileDraft {
    var draft = self
    draft.decline = decline
    draft.picks = []
    draft.text = ""
    draft.subjects = [:]
    draft.typedTools = []
    return draft
  }

  /// Rows checked for what often helps with the conditions picked on the screen before. True when
  /// any was checked.
  mutating func precheck(for conditions: [String]) -> Bool {
    guard question == .learningSupport, decline == nil else {
      return false
    }

    let suggested = conditions.flatMap { Self.helps[$0] ?? [] }.filter { !picks.contains($0) }
    var seen = Set<String>()
    picks.append(contentsOf: suggested.filter { seen.insert($0).inserted })
    return !seen.isEmpty
  }

  private static let helps: [String: [String]] = [
    "adhd": ["stepByStep", "shortAnswers", "shorterDays"],
    "autism": ["plainWords", "stepByStep", noSoundEffects],
    "dyslexia": ["shortAnswers"],
    "dyscalculia": ["stepByStep", "examplesFirst"],
  ]

  /// Nothing picked, typed or declined.
  var isEmpty: Bool {
    guard decline == nil else {
      return false
    }

    switch question {
    case .addressForm, .work, .studies, .conditions: return picks.isEmpty
    default: return picks.isEmpty && trimmed(text).isEmpty && typedTools.isEmpty
    }
  }

  /// Another field needs its name, and Something else needs its words, while picked.
  var isComplete: Bool {
    guard picks.contains(Self.otherOption) else {
      return true
    }

    switch question {
    case .studies: return !trimmed(subjects[Self.otherOption] ?? "").isEmpty
    case .conditions: return !trimmed(text).isEmpty
    default: return true
    }
  }

  func canSave(_ view: ProfileQuestionView) -> Bool {
    isComplete && (view.status == .answered || !isEmpty)
  }

  /// Saving declines an empty screen.
  var isDeclined: Bool {
    decline != nil || isEmpty
  }

  /// The job belongs to a status with work in it.
  var asksJob: Bool {
    question == .work && (picks == ["work"] || picks == ["workAndStudy"])
  }

  /// The `answer` core's `ProfileAnswerInput` takes, with every field.
  var answer: [String: Any] {
    let declined = isDeclined
    let text = declined ? "" : trimmed(text)

    switch question {
    case .work:
      return [
        "declined": declined,
        "job": asksJob && !declined && !text.isEmpty ? text : NSNull(),
        "status": declined || picks.isEmpty ? NSNull() : picks[0],
      ]
    case .studies:
      return [
        "declined": declined,
        "studies": declined
          ? []
          : picks.map { field in
            let subject = trimmed(subjects[field] ?? "")
            return ["field": field, "subject": subject.isEmpty ? NSNull() : subject]
              as [String: Any]
          },
      ]
    case .conditions:
      return [
        "conditions": declined
          ? []
          : picks.map { condition in
            [
              "condition": condition,
              "note": condition == Self.otherOption && !text.isEmpty ? text : NSNull(),
            ] as [String: Any]
          },
        "consented": !declined,
        "declined": declined,
      ]
    case .addressForm:
      return ["declined": declined, "form": declined || picks.isEmpty ? NSNull() : picks[0]]
    case .learningSupport:
      return [
        "declined": declined,
        "needs": declined ? [] : picks.filter { $0 != Self.noSoundEffects },
        "note": text.isEmpty ? NSNull() : text,
        "soundEffects": declined || !picks.contains(Self.noSoundEffects),
      ]
    case .tools:
      // Continue counts what's still in the field as added.
      var added = self
      added.addTypedTools()

      return [
        "declined": declined,
        "favorites": declined ? "" : added.typedTools.joined(separator: ", "),
        "picks": declined ? [] : added.picks,
      ]
    case .watch, .listen, .play, .read, .activities:
      return ["declined": declined, "favorites": text, "picks": declined ? [] : picks]
    }
  }

  /// What `POST /v1/me/profile-questions/answers` takes, and onboarding's answer for this question.
  var input: [String: Any] {
    ["answer": answer, "question": question.rawValue]
  }

  /// Onboarding's Skip declines the question, so the next goal doesn't ask it again. Core fills the
  /// rest of the answer; what helps keeps its sound effects setting.
  var skipInput: [String: Any] {
    ["answer": ["declined": true], "question": question.rawValue]
  }
}

private func trimmed(_ text: String) -> String {
  text.trimmingCharacters(in: .whitespacesAndNewlines)
}
