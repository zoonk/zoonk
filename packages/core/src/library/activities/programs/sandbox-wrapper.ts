import "server-only";

export const SANDBOX_STAGING_DIR = "/vercel/sandbox/runs";
export const SANDBOX_WRAPPER_PATH = "/usr/local/bin/zoonk-code-run";

const MAX_LEARNER_TASKS = 128;
// The sandbox's own processes and the wrapper keep this much of the machine's memory.
const RESERVED_MEMORY_BYTES = 512 * 1024 * 1024;

export const SANDBOX_WRAPPER = `#!/bin/bash
set -eu
action=$1
run=$2
shift 2
[[ "$run" =~ ^[a-f0-9-]{36}$ ]] || exit 125
staged="${SANDBOX_STAGING_DIR}/$run"
work="/var/tmp/zoonk-code/$run"
jail=/sys/fs/cgroup/zoonk-learner

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
    # Every learner process shares one group: bounded tasks and memory, killed together.
    if [[ ! -d "$jail" ]]; then
      # A group hands controllers to its children only once its own processes move to a leaf.
      mkdir -p /sys/fs/cgroup/sandbox
      for attempt in {1..5}; do
        for pid in $(< /sys/fs/cgroup/cgroup.procs); do
          echo "$pid" > /sys/fs/cgroup/sandbox/cgroup.procs 2>/dev/null || true
        done
        echo "+memory +pids" 2>/dev/null > /sys/fs/cgroup/cgroup.subtree_control && break
      done
      mkdir "$jail"
      ram=$(awk '/^MemTotal:/ { print $2 * 1024 }' /proc/meminfo)
      echo $((ram - ${RESERVED_MEMORY_BYTES})) > "$jail/memory.max"
      echo ${MAX_LEARNER_TASKS} > "$jail/pids.max"
      echo 1 > "$jail/memory.oom.group"
    fi
    ooms=$(awk '/^oom_kill / { print $2 }' "$jail/memory.events")
    # Open output sinks in the privileged shell, outside the learner's work directory.
    mkfifo "$staged/$action.stdout.pipe" "$staged/$action.stderr.pipe"
    head -c "$cap" < "$staged/$action.stdout.pipe" > "$staged/$action.stdout" &
    out_pid=$!
    head -c "$cap" < "$staged/$action.stderr.pipe" > "$staged/$action.stderr" &
    err_pid=$!
    set +e
    # Ubuntu's uutils timeout exits 124 after its kill; preserving the status reports SIGKILL as 137.
    timeout --preserve-status -s KILL "$limit" bash -c 'echo $$ > "$0/cgroup.procs" && exec "$@"' "$jail" \\
      runuser -u learner -- env -i \\
      HOME=/home/learner USER=learner LOGNAME=learner PATH=/usr/local/bin:/usr/bin:/bin \\
      LANG=C.UTF-8 TZ=UTC DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 \\
      "$@" </dev/null > "$staged/$action.stdout.pipe" 2> "$staged/$action.stderr.pipe"
    status=$?
    set -e
    echo 1 > "$jail/cgroup.kill"
    # Wait for the group to empty before launching the next phase under the same UID.
    for attempt in {1..40}; do
      grep -q '^populated 0' "$jail/cgroup.events" && break
      sleep 0.025
    done
    grep -q '^populated 0' "$jail/cgroup.events" || exit 125
    wait "$out_pid" "$err_pid"
    if (( $(awk '/^oom_kill / { print $2 }' "$jail/memory.events") > ooms )); then
      echo "The program ran out of memory" >> "$staged/$action.stderr"
      exit 1
    fi
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
