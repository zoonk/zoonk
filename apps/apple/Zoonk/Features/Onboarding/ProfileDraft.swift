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

  /// Chips, of which a learner picks up to three.
  var pickLimit: Int? {
    switch self {
    case .tools, .studies, .watch, .listen, .play, .read, .activities: 3
    case .addressForm, .work, .conditions, .learningSupport: nil
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
  /// The rows that decline the question instead of answering it.
  enum Decline: Equatable {
    /// "None of these", "Nothing to add", "Nothing in particular".
    case noneOfThese
    case ratherNotSay
  }

  static let noSoundEffects = "noSoundEffects"
  static let otherOption = "other"

  let question: ProfileQuestion
  /// In pick order, which studies' subject fields follow. For `work`, the one status; for
  /// `addressForm`, the one form.
  private(set) var picks: [String]
  private(set) var decline: Decline?
  /// Favorites, the job, the `other` condition's note or the support note. Typing answers the
  /// question, as a pick does.
  var text: String {
    didSet {
      if !text.isEmpty {
        decline = nil
      }
    }
  }
  /// Studies: each picked field's course or subject.
  var subjects: [String: String]
  /// Conditions: the learner ticked "Save this to my profile".
  var consented: Bool

  /// A declined question opens on the row that declined it. With memory off, the support note is
  /// hidden, so it's left out of the answer and its saved fact stays as it is.
  init(_ view: ProfileQuestionView, memoryEnabled: Bool = true) {
    question = view.id
    picks = view.saved.picks
    text = view.id == .learningSupport && !memoryEnabled ? "" : view.saved.text
    consented = view.id == .conditions && !view.saved.picks.isEmpty
    subjects = [:]

    for study in view.saved.studies {
      picks.append(study.field)
      subjects[study.field] = study.subject ?? ""
    }

    decline =
      if view.status == .declined && picks.isEmpty && text.isEmpty {
        switch view.id {
        case .addressForm, .work, .conditions: .ratherNotSay
        default: .noneOfThese
        }
      } else {
        nil
      }
  }

  /// False when a chip screen already has its three picks, so the fourth doesn't toggle.
  @discardableResult
  mutating func toggle(_ id: String) -> Bool {
    decline = nil

    if let index = picks.firstIndex(of: id) {
      picks.remove(at: index)
      return true
    }

    if question == .work || question == .addressForm {
      picks = [id]
      return true
    }

    if let limit = question.pickLimit, picks.count >= limit {
      return false
    }

    picks.append(id)
    return true
  }

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
    draft.consented = false
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
    default: return picks.isEmpty && trimmed(text).isEmpty
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

  /// Saving declines an empty screen. Conditions picked without consent never leave the device:
  /// they decline too.
  var isDeclined: Bool {
    decline != nil || isEmpty || (question == .conditions && !consented)
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
        "status": declined ? NSNull() : picks.first ?? NSNull(),
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
    case .tools, .watch, .listen, .play, .read, .activities:
      return ["declined": declined, "favorites": text, "picks": declined ? [] : picks]
    }
  }

  /// What `POST /v1/me/profile-questions/answers` takes, and onboarding's answer for this question.
  var input: [String: Any] {
    ["answer": answer, "question": question.rawValue]
  }
}

private func trimmed(_ text: String) -> String {
  text.trimmingCharacters(in: .whitespacesAndNewlines)
}
