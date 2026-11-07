import SwiftUI

struct PronunciationWordView: View {
  @Environment(\.self) private var environment

  let word: PronunciationRound.Word
  let language: String
  /// So leaving the round stops the word's sound.
  let owner: AnyHashable

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        Text(word.word)
          .typeStyle(.heroTitle)
          .typesettingLanguage(.init(identifier: language))

        if let romanization = word.romanization {
          Text(romanization)
            .foregroundStyle(.mutedForeground)
        }

        if let respelling = word.respelling {
          Text(
            "Say it like \(Text(respelling).font(TypeStyle.note.monospaced().weight(.medium).font(in: environment)).foregroundStyle(.primary))",
            tableName: "Voice", comment: "Introduces how to spell the word's sound"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
      }

      ListenButtons(word: word, language: language, owner: owner)

      if let tip = word.tip {
        Text(tip)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }
    }
    .accessibilityElement(children: .contain)
  }
}

private struct ListenButtons: View {
  @Environment(VoiceServices.self) private var voice
  @State private var pace = Pace.normal

  let word: PronunciationRound.Word
  let language: String
  let owner: AnyHashable

  private enum Pace {
    case normal
    case slow
  }

  var body: some View {
    let state = voice.player.state(for: owner)

    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        button(.normal, state: state) {
          Label {
            Text("Listen", tableName: "Voice", comment: "Plays the word")
          } icon: {
            icon(for: .normal, state: state, idle: "speaker.wave.2")
          }
        }

        button(.slow, state: state) {
          Label {
            Text("Listen slowly", tableName: "Voice", comment: "Plays the word slowly")
          } icon: {
            icon(for: .slow, state: state, idle: "tortoise")
          }
        }
      }

      if case .failed(let limit) = state {
        if let limit {
          HelpLimitNotice(limit: limit)
        } else {
          FailureLine(
            message: LocalizedStringResource(
              "The sound didn't play. Try again.", table: "Voice",
              comment: "Playing a word's sound failed")
          )
          .typeStyle(.note)
        }
      }
    }
    .announcesStatus(limit(state)?.message)
  }

  private func limit(_ state: SpeechPlayer.State) -> HelpLimit? {
    guard case .failed(let limit) = state else {
      return nil
    }

    return limit
  }

  private func button(
    _ value: Pace, state: SpeechPlayer.State, @ViewBuilder label: () -> some View
  ) -> some View {
    Button {
      let isBusy = state == .loading || state == .playing

      if isBusy && pace == value {
        voice.player.stop(owner: owner)
        return
      }

      pace = value
      let audioURL = word.audioUrl.flatMap(URL.init(string:))

      Task {
        await voice.player.play(
          .word(word.word, recording: audioURL, language: language),
          rate: value == .slow ? SpeechPlayer.slowRate : 1,
          owner: owner,
          fallback: (word.word, language))
      }
    } label: {
      label()
    }
    .buttonStyle(.outline)
    .controlSize(.small)
  }

  @ViewBuilder
  private func icon(for value: Pace, state: SpeechPlayer.State, idle: String) -> some View {
    if pace == value, state == .loading {
      ProgressView()
        .controlSize(.mini)
    } else if pace == value, state == .playing {
      Image(systemName: "stop.fill")
    } else {
      Image(systemName: idle)
    }
  }
}
