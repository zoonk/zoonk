# Zoonk for iPhone and iPad

This directory contains the native SwiftUI app for iPhone and iPad. One adaptive iOS target supports both devices.

The iPad app also remains available in Apple's Designed for iPad compatibility mode on Apple silicon Macs and Apple Vision Pro. These compatibility destinations use the iOS build; they are not separate native app targets.

## Requirements

- macOS with Xcode 26.6 or newer
- Xcode command-line tools selected with `xcode-select`
- An installed iOS simulator for running UI tests

## Commands

Build and run the Debug app from the repository root:

| Command       | Purpose                                                    |
| ------------- | ---------------------------------------------------------- |
| `pnpm iphone` | Build, install, and launch the app on an iPhone simulator. |
| `pnpm ipad`   | Build, install, and launch the app on an iPad simulator.   |

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

## API client

Xcode generates the internal Swift API client automatically during a normal build. A fresh clone does not need a separate SDK setup or generation command, and generated Swift files are not committed.

The committed `Zoonk/openapi.json` file is an OpenAPI 3.0 compatibility projection generated from the same schemas as the public OpenAPI 3.1 contract. It must not be edited by hand. After changing the contract, run one command from the repository root:

```sh
pnpm openapi:generate
```

CI checks the file byte-for-byte against the source contract, so a stale artifact cannot merge. Feature code should continue to call small hand-written clients such as `AccountAPIClient`; generated transport types stay behind those feature boundaries, while `APIClientFactory` owns shared transport and middleware configuration.

## StoreKit testing

The shared `Zoonk` scheme activates `Zoonk/Resources/StoreKit/Subscriptions.storekit` when the app runs from Xcode. This test-only file contains the Plus monthly and yearly products and is excluded from the app bundle. The `pnpm iphone` and `pnpm ipad` launchers install the built app directly and therefore do not attach the scheme's StoreKit configuration; use Xcode Run when local product data is required.

Set `APPLE_IAP_ALLOW_XCODE_TRANSACTIONS=true` in `apps/api/.env.local` before testing an end-to-end purchase from Xcode. This opt-in is accepted only outside production, and the Xcode transaction verifier defaults to the Debug bundle identifier `com.zoonk.dev`.

Production product availability, storefront prices, currencies, and localized App Store metadata remain owned by App Store Connect. The app requests the matching product IDs and lets `SubscriptionStoreView` display StoreKit's localized merchandising; never copy prices from the local configuration into SwiftUI.

The API uses [Apple's official App Store Server library](https://github.com/apple/app-store-server-library-node) to validate signed transactions and notifications. Its committed G2 and G3 root certificates are public trust anchors from [Apple PKI](https://www.apple.com/certificateauthority/), not private credentials.

Production and sandbox synchronization require `APPLE_IAP_APP_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, and `APPLE_IAP_PRIVATE_KEY` on the API so every transaction is reconciled against Apple's current subscription chain. Find the numeric Apple ID and bundle ID under [App Information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information), then [generate a separate In-App Purchase key](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/generate-keys-for-in-app-purchases/) under Users and Access > Integrations > In-App Purchase. Keep `APPLE_IAP_ALLOW_XCODE_TRANSACTIONS` disabled, and register `/v1/subscriptions/apple/notifications` as the App Store Server Notifications V2 URL.

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

Build the app after adding or changing copy so Xcode extracts the source strings into the matching `.xcstrings` catalog. Then run `pnpm --filter apple i18n` from the repository root to translate missing Apple strings and `pnpm --filter apple i18n:lint` to validate every catalog. The root `pnpm i18n` and `pnpm i18n:lint` commands include the Apple app when running the same workflows for the full repository.

Keep catalogs together in `Zoonk/Resources/Localization`, named by feature or app surface, and use the generic `pt` locale. Xcode resolves each catalog from its table basename, while Eloqnt automatically discovers every catalog in this directory. Do not edit generated translations or add manual extraction state for ordinary source-driven strings.

## Continuous Integration

GitHub Actions checks Swift formatting and builds the iPhone and iPad app. UI tests remain local because clean hosted macOS runners currently spend several minutes preparing the simulator before executing the tests.
