import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveCallSession, watchConnection } from "./live-call-session";

function fakeDataChannel() {
  const channel = {
    bufferedAmount: 0,
    close() {
      channel.readyState = "closed";
      channel.onclose?.();
    },
    emit(event: object) {
      channel.onmessage?.({ data: JSON.stringify(event) });
    },
    onclose: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onmessage: null as ((event: { data: unknown }) => void) | null,
    onopen: null as (() => void) | null,
    open() {
      channel.readyState = "open";
      channel.onopen?.();
    },
    readyState: "connecting",
    send: vi.fn(),
  };

  return channel;
}

class FakePeerConnection {
  static last: FakePeerConnection | null = null;
  channel = fakeDataChannel();
  connectionState = "new";
  iceConnectionState = "new";
  iceGatheringState = "complete";
  localDescription: { sdp: string } | null = null;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  sender = { replaceTrack: vi.fn(async () => null), track: null };

  constructor() {
    FakePeerConnection.last = this;
  }

  addTrack = vi.fn(() => this.sender);
  addTransceiver = vi.fn(() => ({ sender: this.sender }));
  close = vi.fn(() => {
    this.connectionState = "closed";
    this.onconnectionstatechange?.();
  });
  createDataChannel = vi.fn(() => this.channel);
  createOffer = vi.fn(async () => ({ sdp: "local-offer", type: "offer" }));

  setLocalDescription = vi.fn(async (offer: { sdp: string }) => {
    this.localDescription = offer;
  });

  setRemoteDescription = vi.fn(async () => {
    this.channel.open();
    this.channel.emit({ session: { id: "live_session" }, type: "session.started" });
  });
}

function installWebRTC() {
  const track = { enabled: true, readyState: "live", stop: vi.fn() };

  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);

  vi.stubGlobal("document", {
    createElement: () => ({ pause: vi.fn(), play: vi.fn(async () => null) }),
  });

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ sdp: "remote-answer", sessionId: "live_session" })),
  );

  return { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
}

async function closedWithoutConfirmation(endedByServer: () => Promise<boolean>) {
  const stream = installWebRTC();
  const call = { phase: "connecting" };
  const session = createLiveCallSession({ onEvent: () => null, sessionUrl: "/live-session" });

  watchConnection({
    endedByServer,
    isOpen: () => call.phase === "connecting" || call.phase === "live",
    onEnded: () => {
      call.phase = "ended";
    },
    onLost: () => {
      call.phase = "failed";
    },
    session,
  });

  await session.connect({ stream });
  call.phase = "live";
  FakePeerConnection.last?.channel.close();
  await vi.waitFor(() => expect(call.phase).not.toBe("live"));
  session.dispose();

  return call.phase;
}

describe(watchConnection, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ends the call, keeping it, when our server hung it up at its deadline", async () => {
    await expect(closedWithoutConfirmation(async () => true)).resolves.toBe("ended");
  });

  it("treats a close our server didn't make as a dropped call", async () => {
    await expect(closedWithoutConfirmation(async () => false)).resolves.toBe("failed");
  });
});
