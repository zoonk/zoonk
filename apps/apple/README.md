# Zoonk for iPhone and iPad

This directory contains the native SwiftUI app for iPhone and iPad. One adaptive iOS target supports both devices.

The iPad app also remains available in Apple's Designed for iPad compatibility mode on Apple silicon Macs and Apple Vision Pro. These compatibility destinations use the iOS build; they are not separate native app targets.

## Requirements

- macOS with Xcode 26.6 or newer
- Xcode command-line tools selected with `xcode-select`
- An installed iOS simulator for running UI tests

## Commands

Run commands from this directory:

| Command             | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `make build`        | Build the iPhone and iPad app in Release configuration.       |
| `make build-ios`    | Build the iPhone and iPad app in Release configuration.       |
| `make test`         | Run the app's test targets on the default iPhone simulator.   |
| `make format`       | Format Swift source files in place.                           |
| `make format-check` | Check Swift formatting without changing files.                |
| `make check`        | Run formatting checks, build the app, and run its test suite. |

From the repository root, add `-C apps/apple`, for example `make -C apps/apple check`.

Override the test destination when the default simulator is unavailable:

```sh
make test TEST_DESTINATION='platform=iOS Simulator,name=iPhone 16 Pro,OS=latest'
```

Run one test or test class by passing an Xcode test identifier:

```sh
make test TEST_ARGUMENTS='-only-testing:ZoonkUITests/ZoonkUITests/testPrimaryTabsNavigateToTheirScreens'
```

## Local authentication

Start the repository with `pnpm dev`. The development launcher writes the printed clone-specific API URL to an ignored Xcode configuration file, so the next Debug build connects to the correct local API automatically. For a physical Apple device, run `pnpm dev:lan` instead so the generated configuration uses the reachable `.local` API URL. Open the printed Mailbox URL after requesting an email code to read the local OTP. Debug builds fall back to `http://localhost:4000` when no generated configuration exists, which matches `pnpm dev:direct`; `ZOONK_API_BASE_URL` remains available as a one-off Xcode scheme override.

## Localization

Write user-facing English literals with a localizable SwiftUI or Foundation API, a translator comment, and the feature's String Catalog table. For example:

```swift
LocalizedStringResource(
  "Home",
  table: "Navigation",
  comment: "Navigation title for the app's primary home section.")
```

Build the app after adding or changing copy so Xcode extracts the source strings into the matching `.xcstrings` catalog. Keep translations together by feature, use the generic `pt` locale, and do not add manual extraction state for ordinary source-driven strings.

## Continuous Integration

GitHub Actions checks Swift formatting and builds the iPhone and iPad app. UI tests remain local because clean hosted macOS runners currently spend several minutes preparing the simulator before executing the tests.
