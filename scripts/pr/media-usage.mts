/** `pnpm pr:media`'s help. */
export const USAGE = `Usage: pnpm pr:media check <body.md> [--root <dir>] [--manifests <dir>]...
       pnpm pr:media tiles [<dir>]
       pnpm pr:media read --by <reader> [--findings <file.json>] [<dir>]
       pnpm pr:media resolve <finding id> (--fixed <commit> | --exception <who granted it>) [<dir>]
       pnpm pr:media pending --platform <android|apple> [--to <dir>] <file>...
       pnpm pr:media before --platform <web|android|apple> --source <where> [--to <dir>] <file>...
       pnpm pr:media adopt <before|after> [--to <dir>] <render.json>...
       pnpm pr:media device --platform <android|apple> --device <udid|serial> --name <shot> [--to <dir>]

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
  device   takes an after picture from a booted simulator (--device its udid) or emulator (its
           adb serial) that no capture can take, such as an Android sheet over its page. It
           takes the picture itself and reads the installed app's build from the device: a
           simulator's Debug build stamp must be this checkout's head, built clean; an emulator's
           app, which carries no commit, must have been installed after the head's last change to
           apps/android or packages/, from a clean tree. It refuses otherwise. A web page in a
           phone-sized browser is a web capture: take it with pnpm pr:capture. Its read checks its
           layout. --to is tmp/pr-media/device by default.
  before   records existing before pictures and where they came from; they pass, since a before
           picture's build isn't checked. --to is tmp/pr-media/registered by default for both.
  adopt    puts Android renders into a capture folder as the check reads them: each picture
           beside its <name>.json (a JVM render with -Pzoonk.shots), its record in capture.json
           with the build it came from, and its layout in alignment.json. --to is
           tmp/pr-media/android/<side> by default.

<dir> is tmp/pr-media by default, where pnpm pr:capture writes. After read or resolve there, the
before-and-after section is written again once the check passes.`;
