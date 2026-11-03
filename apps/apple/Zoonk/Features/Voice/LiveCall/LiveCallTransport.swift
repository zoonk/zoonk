import AVFoundation
import Foundation
import WebRTC

/// GPT-Live's other events (usage, errors for a cue it rejected) don't move the call.
enum LiveServerEvent: Equatable, Sendable {
  case started
  case closed
  case transcript(speaker: ConversationSpeaker, delta: String, startMs: Double, endMs: Double)
  case delegation(id: String)
  /// GPT-Live took in the cue sent with this id, at `startMs` on the session's timeline.
  case acknowledged(id: String, startMs: Double)
}

typealias ConversationSpeaker = Components.Schemas.LanguageConversationTurn.SpeakerPayload

/// What the app tells GPT-Live during a call: a cue on one of its channels, and muting the
/// learner's audio.
enum LiveClientCommand: Equatable, Sendable {
  case append(LiveCallCue, delegationId: String? = nil, eventId: String? = nil)
  case mute(Bool)

  /// The event as GPT-Live reads it (`@ai-sdk/openai`'s `serializeOpenAILiveClientEvent`).
  var json: Data {
    let object: [String: Any] =
      switch self {
      case .append(let cue, let delegationId, let eventId):
        [
          "type": "session.\(cue.channel.rawValue).append", "content": cue.text,
          "delegation_id": delegationId.map { $0 as Any } ?? NSNull(),
        ].merging(eventId.map { ["event_id": $0] } ?? [:]) { first, _ in first }
      case .mute(let muted):
        ["type": muted ? "session.input_audio.mute" : "session.input_audio.unmute"]
      }

    return (try? JSONSerialization.data(withJSONObject: object)) ?? Data()
  }
}

extension LiveServerEvent {
  init?(json: Data) {
    struct Envelope: Decodable {
      struct Delegation: Decodable { let id: String }
      let type: String
      let delta: String?
      let startMs: Double?
      let endMs: Double?
      let delegation: Delegation?
      let clientEventId: String?
    }

    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .convertFromSnakeCase

    guard let event = try? decoder.decode(Envelope.self, from: json) else {
      return nil
    }

    switch event.type {
    case "session.started":
      self = .started
    case "session.closed":
      self = .closed
    case "session.input_transcript.delta", "session.output_transcript.delta":
      guard let delta = event.delta, let startMs = event.startMs, let endMs = event.endMs,
        endMs >= startMs
      else {
        return nil
      }

      let speaker: ConversationSpeaker =
        event.type == "session.input_transcript.delta" ? .learner : .character
      self = .transcript(speaker: speaker, delta: delta, startMs: startMs, endMs: endMs)
    case "session.delegation.created":
      guard let id = event.delegation?.id else {
        return nil
      }

      self = .delegation(id: id)
    case "session.commentary.appended", "session.instructions.appended",
      "session.thinking.appended":
      guard let id = event.clientEventId, let startMs = event.startMs else {
        return nil
      }

      self = .acknowledged(id: id, startMs: startMs)
    default:
      return nil
    }
  }
}

@MainActor
protocol LiveCallTransport: AnyObject {
  var onEvent: ((LiveServerEvent) -> Void)? { get set }
  /// The connection went away without GPT-Live saying the session closed.
  var onLost: (() -> Void)? { get set }
  func makeOffer() async throws -> String
  func accept(answer: String) async throws
  func send(_ command: LiveClientCommand)
  /// Whether the learner's microphone heard speech since the last time it was asked.
  func hearsSpeech() async -> Bool
  /// Stops the learner's audio going out and the character's playing, for good.
  func silence()
  func close()
}

/// GPT-Live's events come on the `oai-events` data channel. The peer is created per call and
/// released when it closes.
@MainActor
final class WebRTCLiveCallTransport: LiveCallTransport {
  var onEvent: ((LiveServerEvent) -> Void)?
  var onLost: (() -> Void)?

  private static let factory: RTCPeerConnectionFactory = {
    RTCInitializeSSL()
    return RTCPeerConnectionFactory()
  }()

  /// A disconnected peer gets this long to come back before the call counts as lost.
  private static let disconnectGrace = Duration.seconds(5)
  /// The microphone's level (linear RMS after echo cancellation) that counts as speech: above a
  /// quiet room, below a soft voice.
  private static let speechLevel = 0.02

  private var connection: RTCPeerConnection?
  private var channel: RTCDataChannel?
  private var audioTrack: RTCAudioTrack?
  private var bridge: PeerBridge?
  private var gathered: CheckedContinuation<Void, Never>?
  private var opened: CheckedContinuation<Void, any Error>?
  private var disconnectTimer: Task<Void, Never>?
  private var isClosed = false
  private var heard = MicrophoneEnergy()

  init() {
    configureAudioSession()
  }

  func makeOffer() async throws -> String {
    let configuration = RTCConfiguration()
    configuration.sdpSemantics = .unifiedPlan
    configuration.continualGatheringPolicy = .gatherOnce
    let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
    let bridge = PeerBridge(owner: self)

    guard
      let connection = Self.factory.peerConnection(
        with: configuration, constraints: constraints, delegate: bridge)
    else {
      throw APIError.unavailable
    }

    self.bridge = bridge
    self.connection = connection

    let source = Self.factory.audioSource(with: constraints)
    let track = Self.factory.audioTrack(with: source, trackId: "learner")
    connection.add(track, streamIds: ["call"])
    audioTrack = track

    let channel = connection.dataChannel(
      forLabel: "oai-events", configuration: RTCDataChannelConfiguration())
    channel?.delegate = bridge
    self.channel = channel

    let offer = try await connection.offer(for: constraints)
    try await connection.setLocalDescription(offer)

    // `close()` may have run while WebRTC worked: a wait it can't end anymore would never resume.
    if !isClosed, connection.iceGatheringState != .complete {
      await withCheckedContinuation { gathered = $0 }
    }

    guard !isClosed, let sdp = connection.localDescription?.sdp else {
      throw CancellationError()
    }

    return sdp
  }

  func accept(answer: String) async throws {
    guard let connection, !isClosed else {
      throw CancellationError()
    }

    try await connection.setRemoteDescription(RTCSessionDescription(type: .answer, sdp: answer))

    guard !isClosed else {
      throw CancellationError()
    }

    if channel?.readyState != .open {
      try await withCheckedThrowingContinuation { opened = $0 }
    }
  }

  func send(_ command: LiveClientCommand) {
    guard let channel, channel.readyState == .open else {
      return
    }

    channel.sendData(RTCDataBuffer(data: command.json, isBinary: false))
  }

  func hearsSpeech() async -> Bool {
    guard let connection, !isClosed else {
      return false
    }

    let now = await withCheckedContinuation { continuation in
      // WebRTC answers on its own thread.
      connection.statistics { @Sendable report in
        continuation.resume(returning: MicrophoneEnergy(report))
      }
    }

    defer { heard = now }
    return now.level(since: heard) >= Self.speechLevel
  }

  func silence() {
    audioTrack?.isEnabled = false

    for receiver in connection?.receivers ?? [] {
      receiver.track?.isEnabled = false
    }
  }

  func close() {
    guard !isClosed else {
      return
    }

    isClosed = true
    disconnectTimer?.cancel()
    gathered?.resume()
    gathered = nil
    opened?.resume(throwing: CancellationError())
    opened = nil
    channel?.delegate = nil
    channel?.close()
    connection?.close()
    channel = nil
    connection = nil
    audioTrack = nil
    bridge = nil
    onEvent = nil
    onLost = nil
  }

  fileprivate func iceGatheringChanged(_ state: RTCIceGatheringState) {
    if state == .complete {
      gathered?.resume()
      gathered = nil
    }
  }

  fileprivate func connectionChanged(_ state: RTCPeerConnectionState) {
    switch state {
    case .connected:
      disconnectTimer?.cancel()
    case .disconnected:
      disconnectTimer?.cancel()
      disconnectTimer = Task { [weak self] in
        try? await Task.sleep(for: Self.disconnectGrace)

        guard !Task.isCancelled, self?.connection?.connectionState == .disconnected else {
          return
        }

        self?.lose()
      }
    case .failed, .closed:
      lose()
    default:
      break
    }
  }

  fileprivate func channelChanged(_ state: RTCDataChannelState) {
    switch state {
    case .open:
      opened?.resume()
      opened = nil
    case .closed:
      opened?.resume(throwing: APIError.unavailable)
      opened = nil
      lose()
    default:
      break
    }
  }

  fileprivate func received(_ data: Data) {
    if let event = LiveServerEvent(json: data) {
      onEvent?(event)
    }
  }

  private func lose() {
    guard !isClosed else {
      return
    }

    opened?.resume(throwing: APIError.unavailable)
    opened = nil
    onLost?()
  }

  private func configureAudioSession() {
    let configuration = RTCAudioSessionConfiguration.webRTC()
    configuration.category = AVAudioSession.Category.playAndRecord.rawValue
    configuration.mode = AVAudioSession.Mode.voiceChat.rawValue
    configuration.categoryOptions = [.defaultToSpeaker, .allowBluetoothHFP]
    RTCAudioSessionConfiguration.setWebRTC(configuration)
  }
}

/// The microphone's totals in WebRTC's `media-source` statistics, whose difference gives the level
/// between two readings.
private struct MicrophoneEnergy: Sendable {
  var energy = 0.0
  var duration = 0.0

  init() {}

  init(_ report: RTCStatisticsReport) {
    let source = report.statistics.values.first {
      $0.type == "media-source" && $0.values["kind"] as? String == "audio"
    }
    energy = (source?.values["totalAudioEnergy"] as? NSNumber)?.doubleValue ?? 0
    duration = (source?.values["totalSamplesDuration"] as? NSNumber)?.doubleValue ?? 0
  }

  func level(since earlier: MicrophoneEnergy) -> Double {
    let samples = duration - earlier.duration

    guard samples > 0 else {
      return 0
    }

    return ((energy - earlier.energy) / samples).squareRoot()
  }
}

/// WebRTC calls its delegates on its own threads; this forwards each event to the main actor.
private final class PeerBridge: NSObject, RTCPeerConnectionDelegate, RTCDataChannelDelegate,
  @unchecked Sendable
{
  private weak var owner: WebRTCLiveCallTransport?

  init(owner: WebRTCLiveCallTransport) {
    self.owner = owner
  }

  func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState)
  {
    Task { @MainActor [owner] in owner?.iceGatheringChanged(newState) }
  }

  func peerConnection(
    _ peerConnection: RTCPeerConnection, didChange newState: RTCPeerConnectionState
  ) {
    Task { @MainActor [owner] in owner?.connectionChanged(newState) }
  }

  func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
    let state = dataChannel.readyState
    Task { @MainActor [owner] in owner?.channelChanged(state) }
  }

  func dataChannel(_ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer) {
    let data = buffer.data
    Task { @MainActor [owner] in owner?.received(data) }
  }

  // The call doesn't use these: one audio track each way, ICE gathered before the offer is sent.
  func peerConnection(
    _ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState
  ) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
  func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
  func peerConnection(
    _ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState
  ) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
  }
  func peerConnection(
    _ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]
  ) {}
  func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}
