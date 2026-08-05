# Zoonk for Apple Platforms

This directory contains the native SwiftUI app for iOS, iPadOS, macOS, tvOS, visionOS, and watchOS. Use the Make targets below as the shared command interface for local development, automation, and agents.

## Requirements

- macOS with Xcode 26.6 or newer
- Xcode command-line tools selected with `xcode-select`
- An installed iOS simulator for running UI tests

## Commands

Run commands from this directory:

| Command               | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `make build`          | Build every supported Apple platform in Release configuration. |
| `make build-ios`      | Build the shared app for iOS and iPadOS.                       |
| `make build-macos`    | Build the shared app for macOS.                                |
| `make build-tvos`     | Build the shared app for tvOS.                                 |
| `make build-visionos` | Build the shared app for visionOS.                             |
| `make build-watchos`  | Build the companion watchOS app.                               |
| `make test`           | Run the app's test targets on the default iPhone simulator.    |
| `make format`         | Format Swift source files in place.                            |
| `make format-check`   | Check Swift formatting without changing files.                 |
| `make check`          | Run formatting checks, build every platform, and run tests.    |

From the repository root, add `-C apps/apple`, for example `make -C apps/apple check`.

Override the test destination when the default simulator is unavailable:

```sh
make test TEST_DESTINATION='platform=iOS Simulator,name=iPhone 16 Pro,OS=latest'
```

Run one test or test class by passing an Xcode test identifier:

```sh
make test TEST_ARGUMENTS='-only-testing:ZoonkUITests/ZoonkUITests/testPrimaryTabsNavigateToTheirScreens'
```

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

GitHub Actions checks Swift formatting and builds each supported platform independently. UI tests remain local because clean hosted macOS runners currently spend several minutes preparing the simulator before executing the tests.
