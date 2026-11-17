import XCTest

@testable import Zoonk

@MainActor
final class LessonPromptAudioTests: XCTestCase {
  private static let word = URL(string: "https://cdn.zoonk.test/words/casa.mp3")!
  private static let nextWord = URL(string: "https://cdn.zoonk.test/words/apartamento.mp3")!

  func testAScreenPlaysItsPromptOnArrivalWithoutATapFirst() async {
    let clips = Clips()
    let prompt = LessonPromptAudio()

    prompt.enter(prompt: Self.word, audio: clips.audio)
    _ = try? await waitForTestCondition { clips.plays.count == 1 }

    XCTAssertEqual(clips.plays.first?.url, Self.word)
    XCTAssertEqual(clips.plays.first?.autoplay, true)
    XCTAssertEqual(prompt.playing, Self.word)

    clips.endPlaying()
    _ = try? await waitForTestCondition { prompt.playing == nil }
    XCTAssertEqual(clips.plays.count, 1)
  }

  func testTheLearnersStopHoldsAndTheirNextTapPlaysItAsAsked() async {
    let clips = Clips()
    let prompt = LessonPromptAudio()

    prompt.enter(prompt: Self.word, audio: clips.audio)
    _ = try? await waitForTestCondition { clips.plays.count == 1 }
    prompt.toggle(Self.word, audio: clips.audio)

    XCTAssertNil(prompt.playing)
    XCTAssertEqual(clips.stops, 1)

    clips.endPlaying()
    // A stopped or superseded clip must not restart or clear the current prompt.
    let stoppedClipWindow: Duration = .milliseconds(100)
    try? await Task.sleep(for: stoppedClipWindow)
    XCTAssertNil(prompt.playing)
    XCTAssertEqual(clips.plays.count, 1)

    prompt.toggle(Self.word, audio: clips.audio)
    _ = try? await waitForTestCondition { clips.plays.count == 2 }

    XCTAssertEqual(clips.plays.last?.autoplay, false)
    XCTAssertEqual(prompt.playing, Self.word)
    await clips.endAll()
  }

  func testAStopBeforeTheClipStartsKeepsItFromPlaying() async {
    let clips = Clips()
    let prompt = LessonPromptAudio()

    prompt.enter(prompt: Self.word, audio: clips.audio)
    prompt.toggle(Self.word, audio: clips.audio)
    // A stopped or superseded clip must not restart or clear the current prompt.
    let stoppedClipWindow: Duration = .milliseconds(100)
    try? await Task.sleep(for: stoppedClipWindow)

    XCTAssertTrue(clips.plays.isEmpty)
    XCTAssertNil(prompt.playing)
    await clips.endAll()
  }

  func testAPromptThatStopsShowingStopsPlaying() async {
    let clips = Clips()
    let prompt = LessonPromptAudio()

    prompt.enter(prompt: Self.word, audio: clips.audio)
    _ = try? await waitForTestCondition { clips.plays.count == 1 }
    prompt.enter(prompt: nil, audio: clips.audio)

    XCTAssertNil(prompt.playing)
    XCTAssertEqual(clips.stops, 1)
    await clips.endAll()
  }

  func testTheLastScreensClipEndingLateLeavesTheNextPromptPlaying() async {
    let clips = Clips()
    let prompt = LessonPromptAudio()

    prompt.enter(prompt: Self.word, audio: clips.audio)
    _ = try? await waitForTestCondition { clips.plays.count == 1 }
    prompt.enter(prompt: Self.nextWord, audio: clips.audio)
    _ = try? await waitForTestCondition { clips.plays.count == 2 }

    clips.endPlaying(Self.word)
    // A stopped or superseded clip must not restart or clear the current prompt.
    let stoppedClipWindow: Duration = .milliseconds(100)
    try? await Task.sleep(for: stoppedClipWindow)

    XCTAssertEqual(prompt.playing, Self.nextWord)
    await clips.endAll()
  }

}

@MainActor
private final class Clips {
  private(set) var plays: [(url: URL, autoplay: Bool)] = []
  private(set) var stops = 0
  private var playing: [(url: URL, end: TestContinuation<Void>)] = []

  var audio: LessonAudio {
    LessonAudio(
      play: { url, _, autoplay, _ in
        await withTestVoidContinuation { end in
          self.plays.append((url, autoplay))
          self.playing.append((url, end))
        }
      },
      speak: nil,
      stop: { _ in self.stops += 1 })
  }

  func endPlaying(_ url: URL? = nil) {
    for clip in playing where url == nil || clip.url == url {
      clip.end.resume()
    }

    playing.removeAll { url == nil || $0.url == url }
  }

  func endAll() async {
    endPlaying()

    for _ in 0..<100 {
      await Task.yield()
    }
  }
}
