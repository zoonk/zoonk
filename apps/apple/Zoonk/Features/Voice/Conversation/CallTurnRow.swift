import SwiftUI

/// Whose turn it is, one state at a time, pinned above the reply.
struct CallTurnRow: View {
  let call: LiveCall
  let conversation: LanguageConversation

  var body: some View {
    HStack(spacing: 12) {
      mark
        .frame(width: 36, height: 36)
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        title
          .font(.headline)

        if let detail {
          detail
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .accessibilityElement(children: .combine)
  }

  private var name: String {
    conversation.character.name
  }

  private var state: LiveCall.Turn {
    call.turn
  }

  @ViewBuilder private var mark: some View {
    switch state {
    case .calling, .reconnecting:
      ProgressView()
    case .goodbye, .characterTalking:
      Text(name.prefix(1).uppercased())
        .font(.subheadline.weight(.medium))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.secondarySystemFill), in: .circle)
        .overlay {
          Circle().strokeBorder(Color.secondary, lineWidth: 1.5)
        }
    case .muted:
      Image(systemName: "mic.slash")
        .foregroundStyle(.secondary)
    case .typing:
      Image(systemName: "keyboard")
        .foregroundStyle(.secondary)
    case .listening:
      Image(systemName: "mic.fill")
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .overlay {
          Circle().strokeBorder(.tint, lineWidth: 2)
        }
    case .yourTurn:
      Image(systemName: "mic.fill")
        .foregroundStyle(.background)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.tint, in: .circle)
    }
  }

  private var title: Text {
    switch state {
    case .calling:
      Text("Calling \(name)…", tableName: "Voice", comment: "The call is ringing the character")
    case .reconnecting:
      Text("Reconnecting…", tableName: "Voice", comment: "The call reconnects")
    case .goodbye:
      Text(
        "\(name) is saying goodbye", tableName: "Voice",
        comment: "The character says goodbye before the call ends")
    case .characterTalking:
      Text("\(name) is talking", tableName: "Voice", comment: "The character is speaking")
    case .muted:
      Text("Muted", tableName: "Voice", comment: "The learner muted themselves")
    case .listening:
      Text("Listening…", tableName: "Voice", comment: "The call hears the learner speaking")
    case .typing, .yourTurn:
      Text("Your turn", tableName: "Voice", comment: "The learner should answer now")
    }
  }

  private var detail: Text? {
    switch state {
    case .calling:
      return Text(
        "\(name) answers first.", tableName: "Voice",
        comment: "While calling: the character speaks first")
    case .reconnecting, .goodbye:
      return nil
    default:
      break
    }

    if let wrapUp {
      return wrapUp
    }

    switch state {
    case .characterTalking:
      return call.turns.contains(where: { $0.speaker == .learner })
        ? nil
        : Text(
          "Listen, then answer.", tableName: "Voice",
          comment: "The character's first turn: the learner answers after it")
    case .muted:
      return Text(
        "Unmute to answer out loud, or type your reply.", tableName: "Voice",
        comment: "While muted: how to answer")
    case .typing:
      return Text(
        "Type your reply below.", tableName: "Voice",
        comment: "A call without the microphone: how to answer")
    case .yourTurn:
      return yourTurnDetail
    default:
      return nil
    }
  }

  private var wrapUp: Text? {
    wrapUpLine(call.signals.wrapUp, endsAtLimit: call.endsAtLimit, name: name).map {
      Text(verbatim: $0)
    }
  }

  private var yourTurnDetail: Text? {
    if call.signals.isQuietLong {
      return Text(
        "Take your time.", tableName: "Voice", comment: "The learner has been quiet a while")
    }

    if !call.hasLearnerSpoken {
      return Text(
        "Answer \(name) out loud.", tableName: "Voice",
        comment: "Before the learner's first spoken answer")
    }

    guard conversation.speakingTask == nil,
      let next = conversation.objectives.first(where: { !call.metLabels.contains($0.label) })
    else {
      return nil
    }

    return Text("Tip: \(next.description)", tableName: "Voice", comment: "A hint for the next goal")
  }
}

/// From the talk time, or once every goal is met, until the goodbye.
private func wrapUpLine(
  _ reason: LiveCallEnding.Reason?, endsAtLimit: LiveCall.EndsAtLimit?, name: String
) -> String? {
  switch reason {
  case .time:
    switch endsAtLimit {
    case .day:
      String(
        localized:
          "Your call time for today is almost up. \(name) will say goodbye after your answer.",
        table: "Voice", comment: "The plan's call time for today runs out with this call")
    case .month:
      String(
        localized:
          "Your call time for this month is almost up. \(name) will say goodbye after your answer.",
        table: "Voice", comment: "The plan's call time for this month runs out with this call")
    case nil:
      String(
        localized: "Almost time. \(name) will say goodbye after your answer.", table: "Voice",
        comment: "The call's time is up: the character ends it after the learner's answer")
    }
  case .done:
    String(
      localized: "All goals done. \(name) will wrap up after your answer.", table: "Voice",
      comment: "Every goal is met: the character ends the call after the learner's answer")
  case .goodbye, .quiet, nil:
    nil
  }
}

/// VoiceOver reads the transcript on demand and hears the call itself, so only these changes are
/// spoken: speech over the character's voice would also reach the microphone.
struct CallAnnouncements: ViewModifier {
  let call: LiveCall
  let name: String

  func body(content: Content) -> some View {
    content
      .onChange(of: call.signals.wrapUp) { _, wrapUp in
        if let line = wrapUpLine(wrapUp, endsAtLimit: call.endsAtLimit, name: name) {
          announcePolitely(line)
        }
      }
      .onChange(of: call.muted) { _, muted in
        announcePolitely(
          muted
            ? String(localized: "Muted", table: "Voice", comment: "The learner muted themselves")
            : String(
              localized: "Microphone on", table: "Voice", comment: "The learner unmuted themselves"
            ))
      }
      .onChange(of: call.reconnecting) { _, reconnecting in
        if reconnecting {
          announcePolitely(
            String(localized: "Reconnecting…", table: "Voice", comment: "The call reconnects"))
        }
      }
  }
}

/// Queued after what VoiceOver is reading, not over it.
func announcePolitely(_ text: String) {
  var announcement = AttributedString(text)
  announcement.accessibilitySpeechAnnouncementPriority = .low
  AccessibilityNotification.Announcement(announcement).post()
}
