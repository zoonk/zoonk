import SwiftUI

/// Nothing is graded while talking.
struct ConversationLiveView: View {
  @State private var reply = ""
  @FocusState private var isTyping: Bool

  let call: LiveCall
  let conversation: LanguageConversation
  @Binding var usedHelp: Bool
  let onEnd: () -> Void

  var body: some View {
    // Side panels are panes, never inspectors: one presented while iPhone Duo is folded misplaces
    // the call beside it.
    PaneSplit(primaryShare: 0.55) {
      callColumn(besideAside: true)
    } secondary: {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          aside
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .scenePadding()
      }
      .background(Color(.secondarySystemBackground))
    } single: {
      callColumn(besideAside: false)
    }
    .toolbar {
      ToolbarItem(placement: .principal) {
        CallClock(call: call)
      }
    }
  }

  private func callColumn(besideAside: Bool) -> some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        CharacterRow(intro: CallIntro(conversation), isTalking: call.isCharacterTalking)

        if !besideAside, conversation.speakingTask == nil {
          CallGoals(conversation: conversation, met: call.metLabels)
        }

        transcript

        Text(status)
          .font(.footnote)
          .foregroundStyle(.secondary)
          .accessibilityAddTraits(.updatesFrequently)

        if !besideAside {
          tip

          if usedHelp {
            phrases
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .scenePadding()
    }
    .defaultScrollAnchor(.top, for: .alignment)
    .defaultScrollAnchor(.bottom, for: .sizeChanges)
    .scrollDismissesKeyboard(.interactively)
    // The controls belong to the call's column, so they stay beside the aside rather than under
    // it, and one column moves them off iPhone Duo's fold.
    .safeAreaBar(edge: .bottom) {
      VStack(spacing: 12) {
        typedReply
        controls
      }
      .scenePadding()
      .keepsOffFold()
    }
  }

  @ViewBuilder private var aside: some View {
    if conversation.speakingTask == nil {
      CallGoals(conversation: conversation, met: call.metLabels)
    }

    tip

    if usedHelp {
      phrases
    }
  }

  private var status: String {
    if call.phase == .connecting || call.phase == .idle {
      return call.reconnecting
        ? String(localized: "Reconnecting…", table: "Voice", comment: "The call reconnects")
        : String(localized: "Calling…", table: "Voice", comment: "The call is ringing")
    }

    if call.micBlocked {
      return String(
        localized: "Microphone off", table: "Voice", comment: "The microphone is blocked")
    }

    if call.muted {
      return String(localized: "Muted", table: "Voice", comment: "The learner muted themselves")
    }

    return call.isCharacterTalking
      ? String(
        localized: "\(conversation.character.name) is talking…", table: "Voice",
        comment: "The character is speaking")
      : String(localized: "Listening…", table: "Voice", comment: "The call is listening")
  }

  private var transcript: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(Array(call.turns.enumerated()), id: \.offset) { _, turn in
        let text = turn.text.trimmingCharacters(in: .whitespacesAndNewlines)

        if turn.speaker == .learner {
          Text(text)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
              Color(.secondarySystemFill), in: .rect(cornerRadius: 16, style: .continuous)
            )
            .frame(maxWidth: .infinity, alignment: .trailing)
            .accessibilityLabel(
              Text(
                "You: \(text)", tableName: "Voice", comment: "VoiceOver: the learner's words"))
        } else {
          Text(text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel(Text(verbatim: "\(conversation.character.name): \(text)"))
        }
      }
    }
    .typesettingLanguage(.init(identifier: conversation.targetLanguage))
  }

  @ViewBuilder
  private var tip: some View {
    if let limitNear = call.limitNear {
      Label {
        if limitNear == .month {
          Text(
            "Your call time for this month is almost up.", tableName: "Voice",
            comment: "The plan's call time runs out this month")
        } else {
          Text(
            "Your call time for today is almost up.", tableName: "Voice",
            comment: "The plan's call time runs out today")
        }
      } icon: {
        Image(systemName: "clock")
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
    } else if conversation.speakingTask == nil,
      let next = conversation.objectives.first(where: { !call.metLabels.contains($0.label) })
    {
      Label {
        Text("Tip: \(next.description)", tableName: "Voice", comment: "A hint for the next goal")
      } icon: {
        Image(systemName: "lightbulb")
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }

  private var phrases: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Phrases you can use", tableName: "Voice", comment: "Help's phrases during a call")
        .font(.headline)

      ForEach(conversation.hints, id: \.self) { hint in
        Text(hint)
          .typesettingLanguage(.init(identifier: conversation.targetLanguage))
        Divider()
      }
    }
  }

  /// What's sent while the call connects goes out once it does.
  private var typedReply: some View {
    HStack(spacing: 8) {
      TextField(
        String(
          localized: "Or type your reply", table: "Voice", comment: "Placeholder for a typed reply"),
        text: $reply
      )
      .textFieldStyle(.roundedBorder)
      .focused($isTyping)
      .submitLabel(.send)
      .onSubmit(send)
      .accessibilityLabel(Text("Type your reply", tableName: "Voice", comment: "Typed reply field"))

      Button(action: send) {
        Label {
          Text("Send", tableName: "Voice", comment: "Sends a typed reply")
        } icon: {
          Image(systemName: "arrow.up")
        }
        .labelStyle(.iconOnly)
      }
      .buttonStyle(.mainAction)
      .disabled(reply.trimmingCharacters(in: .whitespaces).isEmpty)
    }
  }

  /// Hanging up is the one red control.
  private var controls: some View {
    HStack(spacing: 8) {
      Button {
        usedHelp = true
      } label: {
        Label {
          Text("Help", tableName: "Voice", comment: "Shows phrases to use in the call")
        } icon: {
          Image(systemName: "lifepreserver")
        }
        .frame(maxWidth: .infinity)
      }

      Button {
        call.toggleMute()
      } label: {
        Label {
          Text("Mute", tableName: "Voice", comment: "Mutes the learner's microphone")
        } icon: {
          Image(systemName: call.muted || call.micBlocked ? "mic.slash.fill" : "mic.fill")
        }
        .frame(maxWidth: .infinity)
      }
      .disabled(call.phase != .live || call.micBlocked)
      .accessibilityAddTraits(call.muted ? .isSelected : [])

      Button(role: .destructive, action: onEnd) {
        Label {
          Text("End", tableName: "Voice", comment: "Hangs up the call")
        } icon: {
          Image(systemName: "phone.down.fill")
        }
        .frame(maxWidth: .infinity)
      }
    }
    .buttonStyle(.bordered)
    .controlSize(.large)
    .labelStyle(.titleAndIcon)
  }

  private func send() {
    call.sendText(reply)
    reply = ""
  }
}

private struct CallGoals: View {
  let conversation: LanguageConversation
  let met: [String]

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text("Goals of the call", tableName: "Voice", comment: "The call's goals while talking")
          .font(.headline)
        Spacer()
        Text("\(met.count)/\(conversation.objectives.count)")
          .font(.subheadline.monospacedDigit())
          .foregroundStyle(.secondary)
      }
      .accessibilityElement(children: .ignore)
      .accessibilityAddTraits(.isHeader)
      .accessibilityLabel(
        Text("Goals of the call", tableName: "Voice", comment: "The call's goals while talking")
      )
      .accessibilityValue(
        Text(
          "\(met.count) of \(conversation.objectives.count)", tableName: "Voice",
          comment: "Goals met out of all"))

      ForEach(conversation.objectives, id: \.label) { objective in
        let isMet = met.contains(objective.label)

        Label {
          Text(objective.label)
            .typesettingLanguage(.init(identifier: conversation.targetLanguage))
        } icon: {
          Image(systemName: isMet ? "checkmark.circle.fill" : "circle")
            .foregroundStyle(isMet ? AnyShapeStyle(.success) : AnyShapeStyle(.tertiary))
        }
        .accessibilityValue(
          isMet ? Text("Done", tableName: "Voice", comment: "VoiceOver: a goal is met") : Text(""))
      }
    }
  }
}

private struct CallClock: View {
  let call: LiveCall

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      let elapsed = call.liveSince.map { max(0, context.date.timeIntervalSince($0)) } ?? 0

      let time = Text(
        "\(clock(elapsed)) / \(clock(TimeInterval(call.limitSeconds)))", tableName: "Voice",
        comment: "The call's elapsed time over its length")

      HStack(spacing: 6) {
        Circle()
          .fill(call.phase == .live ? AnyShapeStyle(.success) : AnyShapeStyle(.tertiary))
          .frame(width: 8, height: 8)

        time
          .font(.subheadline.monospacedDigit())
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(
        Text("Call time", tableName: "Voice", comment: "VoiceOver: the call's clock")
      )
      .accessibilityValue(time)
    }
  }

  private func clock(_ seconds: TimeInterval) -> String {
    Duration.seconds(Int(seconds)).formatted(.time(pattern: .minuteSecond))
  }
}
