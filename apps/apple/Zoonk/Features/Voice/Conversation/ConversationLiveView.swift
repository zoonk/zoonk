import SwiftUI

/// Nothing is graded while talking. Once the call ends its transcript stays, and the controls give
/// way to the save's status, so the end reads as an ending, never as a drop.
struct ConversationLiveView: View {
  @Environment(\.isToolbarVertical) private var isToolbarVertical
  @State private var isShowingPhrases = false
  /// Above the panes: folding or resizing recreates them, and the draft stays.
  @State private var reply = ""
  /// Once: a resize recreating the field mustn't bring the keyboard back.
  @State private var focusesReply = true

  let call: LiveCall
  let conversation: LanguageConversation
  /// Set once the call ended.
  let saving: LiveCallSaveState?
  let onEnd: () -> Void
  let onRetrySave: () -> Void

  var body: some View {
    // Side panels are panes, never inspectors: one presented while iPhone Duo is folded misplaces
    // the call beside it.
    PaneSplit(primaryShare: 0.55) {
      callColumn(besideAside: true)
    } secondary: {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          if conversation.speakingTask == nil {
            CallGoals(conversation: conversation, met: call.metLabels)
          }

          if call.usedHelp {
            CallPhrases(conversation: conversation)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .scenePadding()
      }
      .background(Color(.secondarySystemBackground))
    } single: {
      callColumn(besideAside: false)
    }
    .safeAreaBar(edge: .top) {
      // A vertical bar (iPhone Duo) has no room for the clock, so it tops the call, on its page.
      if isToolbarVertical {
        CallHeader(call: call)
          .scenePadding(.horizontal)
          .frame(maxWidth: .infinity)
          .keepsBeforeHinge()
      }
    }
    .toolbar {
      if !isToolbarVertical {
        ToolbarItem(placement: .principal) {
          CallHeader(call: call)
        }
      }
    }
    .sheet(isPresented: $isShowingPhrases) {
      NavigationStack {
        ScrollView {
          CallPhrases(conversation: conversation)
            .frame(maxWidth: .infinity, alignment: .leading)
            .scenePadding()
        }
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button(role: .close) {
              isShowingPhrases = false
            }
          }
        }
      }
      .presentationDetents([.medium, .large])
    }
    .modifier(CallAnnouncements(call: call, name: conversation.character.name))
  }

  private func callColumn(besideAside: Bool) -> some View {
    CallTranscript(call: call, conversation: conversation, showsGoals: !besideAside)
      // The controls belong to the call's column, so they stay beside the aside rather than under
      // it, and one column moves them off iPhone Duo's fold.
      .safeAreaBar(edge: .bottom) {
        VStack(spacing: 12) {
          if call.phase == .ended || saving != nil {
            CallEndedStatus(
              state: saving ?? .saving,
              isGrading: conversation.kind == .speakingMock || conversation.speakingTask != nil,
              onRetry: onRetrySave)
          } else {
            CallTurnRow(call: call, conversation: conversation)
            CallReply(call: call, reply: $reply, focusesReply: $focusesReply)
            controls(besideAside: besideAside)
          }
        }
        .scenePadding()
        .keepsOffFold()
      }
  }

  private func controls(besideAside: Bool) -> some View {
    CallControls(call: call, onEnd: onEnd) {
      call.useHelp()

      // Beside the call the aside shows the phrases; in one column a sheet does, so they don't
      // grow the transcript the call is following.
      if !besideAside {
        isShowingPhrases = true
      }
    }
  }
}

/// Follows the newest line until the learner scrolls back to read, and offers the way back.
private struct CallTranscript: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var position = ScrollPosition()
  @State private var isFollowing = true

  let call: LiveCall
  let conversation: LanguageConversation
  let showsGoals: Bool

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        CharacterRow(intro: CallIntro(conversation), isTalking: call.signals.isCharacterTalking)

        if showsGoals, conversation.speakingTask == nil {
          CallGoals(conversation: conversation, met: call.metLabels)
        }

        lines
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .scenePadding()
    }
    .scrollPosition($position)
    .scrollDismissesKeyboard(.interactively)
    .onChange(of: call.turns) {
      if isFollowing {
        scrollToEnd()
      }
    }
    // The keyboard or a taller bar covers the end: the newest line stays in sight.
    .onScrollGeometryChange(for: CGFloat.self) { geometry in
      geometry.containerSize.height - geometry.contentInsets.top - geometry.contentInsets.bottom
    } action: { old, new in
      if isFollowing, new < old {
        position.scrollTo(edge: .bottom)
      }
    }
    // Only the learner's own scrolling decides: following's animation passes through the middle.
    .onScrollPhaseChange { _, phase, context in
      switch phase {
      case .tracking, .interacting:
        isFollowing = false
      case .idle where !isFollowing:
        let geometry = context.geometry
        isFollowing =
          geometry.contentOffset.y + geometry.containerSize.height - geometry.contentInsets.bottom
          >= geometry.contentSize.height - 24
      default:
        break
      }
    }
    .overlay(alignment: .bottom) {
      if !isFollowing {
        Button {
          isFollowing = true
          scrollToEnd()
        } label: {
          Label {
            Text(
              "Scroll to latest", tableName: "Voice", comment: "Scrolls a call to its newest line")
          } icon: {
            Image(systemName: "arrow.down")
          }
          .labelStyle(.iconOnly)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .controlSize(.large)
        .padding(.bottom, 8)
      }
    }
  }

  private var lines: some View {
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

  private func scrollToEnd() {
    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) {
      position.scrollTo(edge: .bottom)
    }
  }
}

/// What's sent while the call connects goes out once it does. The field never takes focus by
/// itself: speaking is the main way to answer, and the keyboard would cover the conversation.
private struct CallReply: View {
  @FocusState private var isFocused: Bool

  let call: LiveCall
  @Binding var reply: String
  @Binding var focusesReply: Bool

  var body: some View {
    HStack(spacing: 8) {
      TextField(
        String(
          localized: "Or type your reply", table: "Voice", comment: "Placeholder for a typed reply"),
        text: $reply
      )
      .textFieldStyle(.roundedBorder)
      .focused($isFocused)
      // The learner chose to type: the field takes the place of "Type instead", focus included.
      .onAppear {
        if focusesReply, call.micBlocked {
          isFocused = true
        }

        focusesReply = false
      }
      .submitLabel(.send)
      .onSubmit(send)
      .onChange(of: reply) { _, text in
        // Clearing the field after sending isn't typing.
        if !text.isEmpty {
          call.typing()
        }
      }
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

  private func send() {
    call.sendText(reply)
    reply = ""
  }
}

/// Hanging up is the one red control, as wide as its title needs. When the titles don't fit side
/// by side, as at accessibility sizes, they show on a long press, as a tab bar's do.
private struct CallControls: View {
  let call: LiveCall
  let onEnd: () -> Void
  let onHelp: () -> Void

  var body: some View {
    ViewThatFits(in: .horizontal) {
      buttons
        .labelStyle(.titleAndIcon)
      buttons
        .labelStyle(.iconOnly)
    }
    .lineLimit(1)
    .buttonStyle(.bordered)
    .controlSize(.large)
  }

  private var buttons: some View {
    HStack(spacing: 8) {
      Button(action: onHelp) {
        Label {
          Text("Help", tableName: "Voice", comment: "Shows phrases to use in the call")
        } icon: {
          Image(systemName: "lifepreserver")
        }
        .frame(maxWidth: .infinity)
      }
      .accessibilityShowsLargeContentViewer()

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
      .accessibilityShowsLargeContentViewer()

      Button(role: .destructive, action: onEnd) {
        Label {
          // Before the character answers, nothing is lost by stopping.
          if call.phase == .live {
            Text("End", tableName: "Voice", comment: "Hangs up the call")
          } else {
            Text("Cancel", tableName: "Voice", comment: "Stops a call that hasn't connected yet")
          }
        } icon: {
          Image(systemName: "phone.down.fill")
        }
      }
      .fixedSize()
      .accessibilityShowsLargeContentViewer()
    }
  }
}

/// The call's elapsed time, and a thin bar filling toward its talk time: a soft length, not a
/// countdown.
private struct CallHeader: View {
  let call: LiveCall

  var body: some View {
    TimelineView(.periodic(from: .now, by: 1)) { context in
      let elapsed = call.elapsed(at: context.date)
      let talk = TimeInterval(max(call.callSeconds, 1))
      // Full once the ending started, even when every goal was met early.
      let progress = call.signals.wrapUp == nil ? min(elapsed, talk) : talk
      let time = Text(clock(elapsed))

      VStack(spacing: 4) {
        HStack(spacing: 6) {
          Circle()
            .fill(call.phase == .live ? AnyShapeStyle(.success) : AnyShapeStyle(.tertiary))
            .frame(width: 8, height: 8)

          time
            .font(.subheadline.monospacedDigit())
        }
        .opacity(call.liveSince == nil ? 0 : 1)

        ProgressView(value: progress, total: talk)
          .frame(width: 96)
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

/// The call is over: the transcript stays, and this says what happens with it.
private struct CallEndedStatus: View {
  @State private var isSlow = false

  let state: LiveCallSaveState
  let isGrading: Bool
  let onRetry: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          Text(verbatim: title)
            .font(.headline)

          if let detail {
            Text(verbatim: detail)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
      } icon: {
        if state == .saving {
          ProgressView()
        } else {
          Image(systemName: "exclamationmark.triangle")
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .combine)
      // VoiceOver hears what the screen says the call is doing, an exam's grading included.
      .onAppear {
        if state == .saving {
          announcePolitely([title, detail].compactMap(\.self).joinedSentences())
        }
      }
      .announcesAlert(state == .closing || state == .failed ? title : nil)

      if state == .closing || state == .failed {
        Button(action: onRetry) {
          Text("Try again", tableName: "Voice", comment: "Retries saving a call")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
      }
    }
    .announcesStatus(isSlow ? detail : nil)
    .task(id: state) {
      isSlow = false

      guard state == .saving else {
        return
      }

      // Past this a save says it's still working: a call's feedback takes a few seconds, an
      // exam's grade about half a minute. A save that failed meanwhile cancels the wait.
      try? await Task.sleep(for: .seconds(isGrading ? 45 : 20))

      if !Task.isCancelled {
        isSlow = true
      }
    }
  }

  private var title: String {
    switch state {
    case .closing:
      String(
        localized: "The call is still closing. Try again in a moment.", table: "Voice",
        comment: "The server hasn't confirmed the call ended")
    case .failed:
      String(
        localized: "We couldn't save the call.", table: "Voice", comment: "Saving a call failed")
    default:
      String(
        localized: "Call ended", table: "Voice", comment: "The call hung up and is being saved")
    }
  }

  private var detail: String? {
    guard state == .saving else {
      return nil
    }

    if isGrading {
      return isSlow
        ? String(
          localized: "Still rating your speaking. This is taking longer than usual.",
          table: "Voice", comment: "An exam task's grade takes long")
        : String(
          localized:
            "Rating your speaking on the exam's criteria. It usually takes about half a minute.",
          table: "Voice", comment: "An exam task is graded")
    }

    return isSlow
      ? String(
        localized: "Still writing your feedback. This is taking longer than usual.",
        table: "Voice", comment: "A call's feedback takes long")
      : String(
        localized: "Writing your feedback…", table: "Voice",
        comment: "A call's feedback is written")
  }
}

private struct CallPhrases: View {
  let conversation: LanguageConversation

  var body: some View {
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
