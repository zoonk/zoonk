import SwiftUI

struct PronunciationWordView: View {
  let word: PronunciationRound.Word
  let language: String
  /// So leaving the round stops the word's sound.
  let owner: AnyHashable

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        Text(word.word)
          .font(.largeTitle.bold())
          .typesettingLanguage(.init(identifier: language))

        if let romanization = word.romanization {
          Text(romanization)
            .foregroundStyle(.secondary)
        }

        if let respelling = word.respelling {
          Text(
            "Say it like \(Text(respelling).monospaced().fontWeight(.medium).foregroundStyle(.primary))",
            tableName: "Voice", comment: "Introduces how to spell the word's sound"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      }

      ListenButtons(word: word, language: language, owner: owner)

      if let tip = word.tip {
        Text(tip)
          .font(.footnote)
          .foregroundStyle(.secondary)
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
          Text(
            "The sound didn't play. Try again.", tableName: "Voice",
            comment: "Playing a word's sound failed"
          )
          .font(.footnote)
          .foregroundStyle(.destructive)
        }
      }
    }
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
    .buttonStyle(.bordered)
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
