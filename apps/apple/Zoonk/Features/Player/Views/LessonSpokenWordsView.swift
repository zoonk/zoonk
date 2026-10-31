import SwiftUI

/// Main's `LessonSpokenWords`: the sentence as heard, each word marked right, different or missed.
/// A word to practice is a button: picking it plays it at normal speed, then slowly, and shows how
/// it sounds and its tip.
struct LessonSpokenWordsView: View {
  @Environment(\.lessonAudio) private var audio
  @State private var selected = 0
  @State private var playing: Task<Void, Never>?

  let heard: SpokenHeard
  let language: String

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("What we heard", tableName: "Player", comment: "Above a spoken answer's words as heard")
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)

      FlowLayout(spacing: 6) {
        ForEach(Array(heard.words.enumerated()), id: \.offset) { _, word in
          if let index = heard.wordsToPractice.firstIndex(where: { $0.text == word.text }) {
            Button {
              select(index)
            } label: {
              HeardWordText(word: word)
                .padding(.horizontal, 4)
                .background(.destructive.opacity(0.12), in: .rect(cornerRadius: 6))
                .overlay {
                  if index == selected {
                    RoundedRectangle(cornerRadius: 6).strokeBorder(.destructive.opacity(0.5))
                  }
                }
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(index == selected ? .isSelected : [])
          } else {
            HeardWordText(word: word)
          }
        }
      }
      .font(.title3)

      if heard.wordsToPractice.indices.contains(selected) {
        practice(heard.wordsToPractice[selected])
      }
    }
    .onDisappear {
      playing?.cancel()
      audio.stop()
    }
  }

  private func practice(_ word: SpokenHeard.PracticeWord) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      ViewThatFits(in: .horizontal) {
        HStack {
          name(word)
          Spacer(minLength: 8)
          listenButtons(word)
        }

        VStack(alignment: .leading, spacing: 8) {
          name(word)
          listenButtons(word)
        }
      }

      if let tip = word.tip {
        LessonRichText(tip)
          .font(.subheadline)
      }
    }
    .padding(.leading, 12)
    .overlay(alignment: .leading) {
      Rectangle().fill(.separator).frame(width: 2)
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text("How to say \(word.text)", tableName: "Player", comment: "A word to practice saying"))
  }

  private func name(_ word: SpokenHeard.PracticeWord) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      Text(word.text)
        .fontWeight(.semibold)
        .typesettingLanguage(.init(identifier: language))

      if let respelling = word.respelling {
        Text(
          "sounds like \(respelling)", tableName: "Player",
          comment: "How a word to practice sounds, spelled for the learner"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
    }
  }

  @ViewBuilder
  private func listenButtons(_ word: SpokenHeard.PracticeWord) -> some View {
    if canPlay(word) {
      HStack(spacing: 6) {
        Button {
          play(word, rates: [1])
        } label: {
          Label {
            Text("Listen", tableName: "Player", comment: "Plays a word to practice")
          } icon: {
            Image(systemName: "speaker.wave.2")
          }
        }

        Button {
          play(word, rates: [LessonAudio.slowRate])
        } label: {
          Label {
            Text("Slowly", tableName: "Player", comment: "Plays a word to practice slowly")
          } icon: {
            Image(systemName: "tortoise")
          }
        }
      }
      .buttonStyle(.bordered)
      .controlSize(.small)
    }
  }

  private func canPlay(_ word: SpokenHeard.PracticeWord) -> Bool {
    word.audioUrl.flatMap(URL.init(string:)) != nil || audio.speak != nil
  }

  private func select(_ index: Int) {
    selected = index
    play(heard.wordsToPractice[index], rates: [1, LessonAudio.slowRate])
  }

  private func play(_ word: SpokenHeard.PracticeWord, rates: [Float]) {
    let recording = word.audioUrl.flatMap(URL.init(string:))
    playing?.cancel()
    playing = Task {
      for rate in rates {
        guard !Task.isCancelled else { return }

        if let speak = audio.speak {
          await speak(word.text, language, recording, rate)
        } else if let recording {
          await audio.play(recording, rate: rate)
        }
      }
    }
  }
}

private struct HeardWordText: View {
  let word: SpokenHeard.Word

  var body: some View {
    Group {
      switch word.status {
      case .correct:
        Text(word.text)
          .foregroundStyle(.success)
      case .different:
        Text(word.text)
          .underline(pattern: .dot, color: .destructive)
          .foregroundStyle(.destructive)
      case .missed:
        Text(word.text)
          .strikethrough()
          .foregroundStyle(.secondary)
      }
    }
    .accessibilityLabel(label)
  }

  private var label: Text {
    switch word.status {
    case .correct:
      Text(word.text)
    case .different:
      Text(
        "\(word.text) (heard as \(word.heard ?? ""))", tableName: "Player",
        comment: "VoiceOver: a spoken word that sounded like another; the second is what was heard")
    case .missed:
      Text(
        "\(word.text) (not heard)", tableName: "Player",
        comment: "VoiceOver: a word missing from a spoken answer")
    }
  }
}
