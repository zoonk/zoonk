/** `pnpm pr:media`'s help. */
export const USAGE = `Usage: pnpm pr:media check <body.md> [--root <dir>] [--manifests <dir>]...
       pnpm pr:media tiles [<dir>]
       pnpm pr:media read --by <reader> [--findings <file.json>] [<dir>]
       pnpm pr:media resolve <finding id> (--fixed <commit> | --exception <who granted it>) [<dir>]
       pnpm pr:media pending --platform <android|apple> [--to <dir>] <file>...
       pnpm pr:media before --platform <web|android|apple> --source <where> [--to <dir>] <file>...
       pnpm pr:media adopt <before|after> [--to <dir>] <render.json>...
       pnpm pr:media device --platform <android|apple> --device <name> [--to <dir>] <file>...

Checks that every picture a PR body shows was captured, from which build, and read.

  check    fails when a picture in the body has no capture record with its bytes; when an after
           picture's build is unknown, has uncommitted changes, or is older than a later commit to
           its app or packages/; when an after picture has no read or an unresolved finding; when
           an after capture's alignment.json fails a layout relationship, couldn't measure
           one, or misses a required scenario; and when a native picture is still pending.
           Picture paths are relative to --root (the
           body's folder by default). Each picture's capture.json is looked for in its folder and
           every folder above it, and anywhere under each --manifests folder, so a
           picture copied away from its capture needs --manifests. Exits non-zero on any failure.
  tiles    cuts every after picture under <dir> into original-size tiles and writes
           <dir>/read/READ.md, the reader's sheet: pictures first, numbers second, then words.
  read     records a read on every after picture under <dir> that has none: clean, or the
           findings in the file, a JSON array of { "file", "text" } with files as READ.md lists them.
  resolve  marks a finding fixed in a commit, or an exception the user granted.
  pending  records native after pictures with neither a capture nor a device record; they keep
           failing the check as pending.
  device   records after pictures taken on an emulator or a simulator, which no capture can
           take (an Android sheet over its page): --device names it, such as "Pixel 9 emulator,
           API 36". Each is stamped with this checkout's commit and uncommitted changes, so it
           fails as uncommitted or stale as a capture would, and still needs its read; the check
           says its layout wasn't measured. --to is tmp/pr-media/device by default.
  before   records existing before pictures and where they came from; they pass, since a before
           picture's build isn't checked. --to is tmp/pr-media/registered by default for both.
  adopt    puts Android renders into a capture folder as the check reads them: each picture
           beside its <name>.json (a JVM render with -Pzoonk.shots), its record in capture.json
           with the build it came from, and its layout in alignment.json. --to is
           tmp/pr-media/android/<side> by default.

<dir> is tmp/pr-media by default, where pnpm pr:capture writes. After read or resolve there, the
before-and-after section is written again once the check passes.`;
