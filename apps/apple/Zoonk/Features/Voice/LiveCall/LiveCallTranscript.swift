import Foundation

/// Mirrors main's `live-call-transcript.ts`: GPT-Live sends each speaker's transcript in fragments.
/// A typed reply has no timeline.
struct TranscriptTurn: Equatable, Sendable {
  let speaker: ConversationSpeaker
  var text: String
  let startMs: Double?
  var endMs: Double?
}

/// The longest turn and the most turns the API takes (core's `conversation-turn-limits`).
private let maxTurnLength = 2000
private let maxTurns = 300

extension [TranscriptTurn] {
  /// Fragments are appended exactly as received, since they carry their own spaces.
  func adding(
    _ delta: String, speaker: ConversationSpeaker, startMs: Double, endMs: Double
  ) -> [TranscriptTurn] {
    var turns = self

    if let last = turns.last, last.speaker == speaker, last.startMs != nil {
      turns[turns.count - 1].text += delta
      turns[turns.count - 1].endMs = endMs
      return turns
    }

    turns.append(TranscriptTurn(speaker: speaker, text: delta, startMs: startMs, endMs: endMs))
    return turns
  }

  func addingTypedReply(_ text: String) -> [TranscriptTurn] {
    self + [TranscriptTurn(speaker: .learner, text: text, startMs: nil, endMs: nil)]
  }

  var spokenSeconds: Int {
    let spokenMs = filter { $0.speaker == .learner }
      .reduce(0.0) { total, turn in
        guard let start = turn.startMs, let end = turn.endMs else {
          return total
        }

        return total + end - start
      }

    return Int((spokenMs / 1000).rounded())
  }

  var conversationTurns: [ConversationTurn] {
    [ConversationTurn](
      compactMap { turn -> ConversationTurn? in
        let text = String(
          turn.text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maxTurnLength))
        return text.isEmpty ? nil : ConversationTurn(speaker: turn.speaker, text: text)
      }
      .prefix(maxTurns))
  }
}

/// A cue from the connection setup: what to tell GPT-Live, and on which channel.
typealias LiveCallCue = Components.Schemas.LiveCallCue

extension LiveCallCue {
  /// The typed-reply cue with the learner's words after it, quoted as data: never instructions.
  func quoting(_ reply: String) -> LiveCallCue {
    LiveCallCue(channel: channel, text: text + jsonString(reply))
  }

  /// `JSON.stringify` of a string: quoted and escaped.
  private func jsonString(_ value: String) -> String {
    guard
      let data = try? JSONEncoder().encode(value),
      let encoded = String(data: data, encoding: .utf8)
    else {
      return "\"\(value)\""
    }

    // JSONEncoder escapes slashes; JSON.stringify doesn't.
    return encoded.replacingOccurrences(of: "\\/", with: "/")
  }
}
