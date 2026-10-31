import { LIVE_CALL_SDP_OFFER } from "@zoonk/testing/fixtures/language";
import { describe, expect, it } from "vitest";
import { isWebRtcAudioOffer } from "./webrtc-offer";

const FIREFOX_OFFER = [
  "v=0",
  "o=mozilla...THIS_IS_SDPARTA-99.0 7214155180196400358 0 IN IP4 0.0.0.0",
  "s=-",
  "t=0 0",
  "a=fingerprint:sha-256 8F:2C:7A:11:4B:90:3E:D5:66:0A:B4:C2:19:F8:7E:52:A3:3D:09:BC:41:E7:5F:2A:93:C8:0D:6E:B1:74:28:5C",
  "a=group:BUNDLE 0 1",
  "a=ice-options:trickle",
  "a=msid-semantic:WMS *",
  "m=audio 9 UDP/TLS/RTP/SAVPF 109 9 0 8 101",
  "c=IN IP4 0.0.0.0",
  "a=sendrecv",
  "a=fmtp:109 maxplaybackrate=48000;stereo=1;useinbandfec=1",
  "a=ice-pwd:3c3b1e9a5c2e6f0d8e0a7b6c5d4e3f2a",
  "a=ice-ufrag:5e3a1b2c",
  "a=mid:0",
  "a=rtcp-mux",
  "a=rtpmap:109 opus/48000/2",
  "a=setup:actpass",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=ice-pwd:3c3b1e9a5c2e6f0d8e0a7b6c5d4e3f2a",
  "a=ice-ufrag:5e3a1b2c",
  "a=mid:1",
  "a=setup:actpass",
  "a=sctp-port:5000",
  "",
].join("\r\n");

describe(isWebRtcAudioOffer, () => {
  it.each([
    ["a Chromium offer", LIVE_CALL_SDP_OFFER],
    ["a Firefox offer", FIREFOX_OFFER],
    ["an offer with bare line feeds", LIVE_CALL_SDP_OFFER.replaceAll("\r\n", "\n")],
  ])("accepts %s", (_, sdp) => {
    expect(isWebRtcAudioOffer(sdp)).toBe(true);
  });

  it.each([
    ["one character", "x"],
    ["a word", "offer"],
    ["a session without media", "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"],
    ["a video-only offer", LIVE_CALL_SDP_OFFER.replace("m=audio ", "m=video ")],
    [
      "an offer without ICE credentials",
      LIVE_CALL_SDP_OFFER.replaceAll(/a=ice-ufrag:.*\r\n/gu, ""),
    ],
    [
      "an offer without a DTLS fingerprint",
      LIVE_CALL_SDP_OFFER.replaceAll(/a=fingerprint:.*\r\n/gu, ""),
    ],
    ["an offer that doesn't start with its version", LIVE_CALL_SDP_OFFER.replace("v=0\r\n", "")],
    ["an offer with a line that isn't SDP", LIVE_CALL_SDP_OFFER.replace("s=-", "s=-\r\n<script>")],
  ])("refuses %s", (_, sdp) => {
    expect(isWebRtcAudioOffer(sdp)).toBe(false);
  });
});
