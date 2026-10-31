# Measuring the Apple app

How to measure requests, memory, leaks, CPU and hangs for the iPhone and iPad app on a simulator. Every command here was run on Xcode 27.1 with an iOS 27 simulator. Measure the screens a change touches, before and after, on the same simulator, and put the numbers in the report.

## Set up

- Start the checkout's backend (`pnpm dev` to iterate; `pnpm start` for timings). `pnpm dev` writes `apps/apple/Configuration/Local.xcconfig` with the checkout's API URL; build the Debug app after it exists so the app talks to that API:

  ```sh
  UDID=<your simulator>
  xcodebuild -quiet -skipPackagePluginValidation -packageAuthorizationProvider netrc \
    -project apps/apple/Zoonk.xcodeproj -scheme Zoonk \
    -configuration Debug -destination "id=$UDID" -derivedDataPath apps/apple/DerivedData/Simulator build
  xcrun simctl install $UDID apps/apple/DerivedData/Simulator/Build/Products/Debug-iphonesimulator/Zoonk.app
  xcrun simctl launch --terminate-running-process $UDID com.zoonk.dev
  ```

- Use a signed build for anything that signs in. `make test` and `build-for-testing` with `CODE_SIGNING_ALLOWED=NO` replace the app in the same DerivedData with an unsigned one that can't read the Keychain, so the account shows "Account unavailable" and makes no request: rebuild with the command above and reinstall before measuring.
- Sign in with email as a persona copy (`pnpm dev:persona <name>`). The code is the newest message for that address in the mailbox's JSON: `curl -s <mailbox URL>/api/emails`.
- Other agents may run Zoonk on other simulators, so always take the process of your own device: `PID=$(pgrep -f "CoreSimulator/Devices/$UDID/.*/Zoonk.app/Zoonk$")`.
- Drive the app with T3 Code's device tools (`agent-device`). Its element refs expire after every action, so take a new snapshot before each tap. Snapshots make the app build its accessibility tree, which costs CPU: stop driving it before measuring idle CPU or recording a profile you want to read.

## Requests per screen and per tab switch

CFNetwork logs one summary line for every request the app finishes, API calls and images alike, on a simulator and with `pnpm start`:

```sh
xcrun simctl spawn $UDID log stream --level debug --style compact \
  --predicate 'process == "Zoonk" AND subsystem == "com.apple.CFNetwork" AND category == "Summary"' > net.log &
# … use the app …
kill %1
grep -c 'summary for task' net.log                                      # requests
grep 'summary for task' net.log | grep -c response_bytes                # of those, over the network
```

A line without `response_bytes` came from `URLCache`. The summary has no URL; to see which endpoints a step called, read the API's request log, which `pnpm dev` prints as `api:dev:  GET /v1/... 200 in 18ms` (a production `pnpm start` server doesn't log requests). Mark the log's line count before the step and read the lines after it.

The line: returning to a tab or screen whose data is fresh makes no request; opening a screen reads each resource it shows once; a mutation refreshes only the resources it changed; repeat image loads come from the cache. Instruments' Network template can't record on a simulator ("Network Connections is not supported in the Simulator"), so use the log above, or a device for Instruments.

## Memory and leaks

```sh
footprint $PID | head -3                 # "Footprint: 92 MB"
leaks $PID | grep 'leaks for'            # "51 leaks for 2720 total leaked bytes"
heap $PID | awk '$4 ~ /^Zoonk\./ { print $1, $4 }'   # live instances of the app's own classes
leaks --outputGraph=zoonk.memgraph $PID  # memory graph to open in Xcode
```

Repeat the same navigation loop ten times and compare footprint, leak count and the app's instance counts after the first loop and the last. They must stay flat: growth means something keeps every visit alive. A few dozen small system leaks (the Objective-C runtime's `map_images_nolock`, `CGPath`, `dispatch_source_t`) appear at launch and stay constant; a leak count that grows with the loops is the app's. For each leak's allocation stack, launch with `SIMCTL_CHILD_MallocStackLogging=1 xcrun simctl launch --terminate-running-process $UDID com.zoonk.dev` and run `leaks $PID` again: it prints a `STACK OF n INSTANCES OF 'ROOT LEAK: …'` block per leak. `xcrun xctrace record --template Leaks` (or `Allocations`) records on a simulator for a person to open in Instruments, but `xctrace export` has no table for leaks, so agents read the command-line tools.

## CPU and hangs

- **Idle:** with nothing driving the app, read its CPU time before and after 30 seconds: `ps -o time= -p $PID`. An idle screen stays near 0% (Zoonk's tabs measured 0.13%); a timer, an animation or a polling loop shows up here.
- **Profile and hangs:**

  ```sh
  xcrun xctrace record --template 'Time Profiler' --device $UDID --attach $PID --time-limit 20s --no-prompt --output tp.trace
  xcrun xctrace export --input tp.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]' > tp.xml
  xcrun xctrace export --input tp.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="potential-hangs"]' > hangs.xml
  ```

  Time Profiler samples every millisecond, so the `time-profile` table's rows approximate CPU milliseconds; each `<row>` in `potential-hangs` (and `hang-risks`) is a hang to explain. `--no-prompt` skips a privacy prompt that otherwise blocks a scripted recording.

- The SwiftUI and Animation Hitches templates fail on a simulator ("Hitches is not supported on this platform"). To see which views update and why, record the SwiftUI template on a device, or in Xcode with Product > Profile, following [Understanding and improving SwiftUI performance](https://developer.apple.com/documentation/xcode/understanding-and-improving-swiftui-performance).

## Report

For each screen or flow the change touches: requests on first open, on return and on each tab switch (before and after), footprint and leak count after one and ten loops, idle CPU, and any hang. Save the commands' output next to the screenshots.

## Generated API client

The app imports the local `apps/apple/ZoonkAPI` package. Its generator inputs live in `apps/apple/ZoonkAPI/Sources/ZoonkAPI/openapi.json` and `openapi-generator-config.yaml`; regenerate the contract with `pnpm openapi:generate`. Include the package sources in Apple formatting checks.
