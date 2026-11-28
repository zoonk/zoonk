import "server-only";

export const SANDBOX_STAGING_DIR = "/vercel/sandbox/runs";
export const SANDBOX_WRAPPER_PATH = "/usr/local/bin/zoonk-code-run";

export const SANDBOX_WRAPPER = `#!/bin/bash
set -eu
action=$1
run=$2
shift 2
[[ "$run" =~ ^[a-f0-9-]{36}$ ]] || exit 125
staged="${SANDBOX_STAGING_DIR}/$run"
work="/var/tmp/zoonk-code/$run"

case "$action" in
  prepare)
    install -d -o learner -g learner -m 0700 "$work"
    for source in "$@"; do
      install -o learner -g learner -m 0600 "$staged/$source" "$work/$source"
    done
    ;;
  compile|run)
    limit=$1
    cap=$2
    shift 2
    cd "$work"
    # Open output sinks in the privileged shell, outside the learner's work directory.
    mkfifo "$staged/$action.stdout.pipe" "$staged/$action.stderr.pipe"
    head -c "$cap" < "$staged/$action.stdout.pipe" > "$staged/$action.stdout" &
    out_pid=$!
    head -c "$cap" < "$staged/$action.stderr.pipe" > "$staged/$action.stderr" &
    err_pid=$!
    set +e
    timeout -s KILL "$limit" runuser -u learner -- env -i \\
      HOME=/home/learner USER=learner LOGNAME=learner PATH=/usr/local/bin:/usr/bin:/bin \\
      LANG=C.UTF-8 TZ=UTC DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 \\
      "$@" </dev/null > "$staged/$action.stdout.pipe" 2> "$staged/$action.stderr.pipe"
    status=$?
    set -e
    if pkill -KILL -u learner; then
      # Wait for stragglers before launching the next phase under the same UID.
      for attempt in {1..20}; do
        pgrep -u learner -r D,I,R,S,T,W,t >/dev/null || break
        pkill -KILL -u learner || true
        sleep 0.025
      done
      if pgrep -u learner -r D,I,R,S,T,W,t >/dev/null; then exit 125; fi
    fi
    wait "$out_pid" "$err_pid"
    if [[ "$status" == 137 ]]; then exit 137; fi
    if [[ "$status" != 0 ]]; then exit 1; fi
    ;;
  clean)
    rm -rf -- "$work" "$staged"
    ;;
  *)
    exit 125
    ;;
esac
`;
