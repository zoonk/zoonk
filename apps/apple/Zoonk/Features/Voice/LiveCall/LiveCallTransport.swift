import AVFoundation
import Foundation
import WebRTC

/// What GPT-Live says on the call's data channel that the call acts on. Its other events (usage,
/// acknowledgments, errors for a cue it rejected) don't move the call.
enum LiveServerEvent: Equatable, Sendable {
  case started
  case closed
  case transcript(speaker: ConversationSpeaker, delta: String, startMs: Double, endMs: Double)
  case delegation(id: String)
}

typealias ConversationSpeaker = Components.Schemas.LanguageConversationTurn.SpeakerPayload

/// What the app tells GPT-Live during a call: context it acts on now (`instructions`) or only
/// keeps in mind (`thinking`), and muting the learner's audio.
enum LiveClientCommand: Equatable, Sendable {
  case instructions(String)
  case thinking(String, delegationId: String? = nil)
  case mute(Bool)

  /// The event as GPT-Live reads it (`@ai-sdk/openai`'s `serializeOpenAILiveClientEvent`).
  var json: Data {
    let object: [String: Any] =
      switch self {
      case .instructions(let content):
        ["type": "session.instructions.append", "content": content, "delegation_id": NSNull()]
      case .thinking(let content, let delegationId):
        [
          "type": "session.thinking.append", "content": content,
          "delegation_id": delegationId.map { $0 as Any } ?? NSNull(),
        ]
      case .mute(let muted):
        ["type": muted ? "session.input_audio.mute" : "session.input_audio.unmute"]
      }

    return (try? JSONSerialization.data(withJSONObject: object)) ?? Data()
  }
}

extension LiveServerEvent {
  /// Reads one data-channel message; nil for events the call doesn't act on.
  init?(json: Data) {
    struct Envelope: Decodable {
      struct Delegation: Decodable { let id: String }
      let type: String
      let delta: String?
      let startMs: Double?
      let endMs: Double?
      let delegation: Delegation?
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
    default:
      return nil
    }
  }
}

/// A call's connection to GPT-Live. The live one is WebRTC; tests use a fake.
@MainActor
protocol LiveCallTransport: AnyObject {
  /// GPT-Live's events, on the main actor.
  var onEvent: ((LiveServerEvent) -> Void)? { get set }
  /// The connection went away without GPT-Live saying the session closed.
  var onLost: (() -> Void)? { get set }
  /// Opens the microphone's track and the data channel and returns the offer to send.
  func makeOffer() async throws -> String
  /// Applies GPT-Live's answer and waits for the data channel to open.
  func accept(answer: String) async throws
  func send(_ command: LiveClientCommand)
  /// Stops the learner's audio going out and the character's playing, for good.
  func silence()
  func close()
}

/// The call over WebRTC: the microphone goes out as the call's audio track, the character's voice
/// plays back through the system's voice-chat audio (echo cancellation, Bluetooth, the speaker),
/// and GPT-Live's events come on the `oai-events` data channel. The peer is created per call and
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

  private var connection: RTCPeerConnection?
  private var channel: RTCDataChannel?
  private var audioTrack: RTCAudioTrack?
  private var bridge: PeerBridge?
  private var gathered: CheckedContinuation<Void, Never>?
  private var opened: CheckedContinuation<Void, any Error>?
  private var disconnectTimer: Task<Void, Never>?
  private var isClosed = false

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

    if connection.iceGatheringState != .complete {
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

  // MARK: - Peer events, on the main actor

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

  /// A voice call: the learner's microphone and the character's voice through the speaker (or
  /// headphones), with the system's echo cancellation, kept running in the background.
  private func configureAudioSession() {
    let configuration = RTCAudioSessionConfiguration.webRTC()
    configuration.category = AVAudioSession.Category.playAndRecord.rawValue
    configuration.mode = AVAudioSession.Mode.voiceChat.rawValue
    configuration.categoryOptions = [.defaultToSpeaker, .allowBluetoothHFP]
    RTCAudioSessionConfiguration.setWebRTC(configuration)
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
