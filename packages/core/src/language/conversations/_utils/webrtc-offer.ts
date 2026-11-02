const SDP_LINE = /^[a-z]=/u;

const REQUIRED_LINES = [
  /^o=/u,
  /^s=/u,
  /^t=/u,
  /^m=audio /u,
  /^a=ice-ufrag:/u,
  /^a=ice-pwd:/u,
  /^a=fingerprint:/u,
];

export function isWebRtcAudioOffer(sdp: string): boolean {
  const lines = sdp.replace(/\r?\n$/u, "").split(/\r?\n/u);

  return (
    lines[0] === "v=0" &&
    lines.every((line) => SDP_LINE.test(line)) &&
    REQUIRED_LINES.every((required) => lines.some((line) => required.test(line)))
  );
}
