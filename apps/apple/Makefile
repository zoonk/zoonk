PROJECT := Zoonk.xcodeproj
APP_SCHEME := Zoonk
UNIT_TEST_SCHEME := ZoonkUnitTests
SWIFT_SOURCES := Zoonk ZoonkAPI/Package.swift ZoonkAPI/Sources ZoonkTests ZoonkUITests
CONFIGURATION ?= Debug
XCODEBUILD_ARGUMENTS ?=
# The WebRTC package is a binary download; with the default Keychain credential lookup, xcodebuild
# can wait forever on a Keychain prompt in non-interactive shells. Public downloads need no login.
# Builds stay in the checkout, so removing an agent's worktree removes them too. Every checkout on
# the Mac shares the Swift packages (with-simulator.mts adds them to local simulator runs); CI
# caches them inside the build folder.
XCODEBUILD_COMMAND := xcodebuild -quiet -skipPackagePluginValidation -packageAuthorizationProvider netrc -derivedDataPath DerivedData/Make $(XCODEBUILD_ARGUMENTS) -project "$(PROJECT)"
XCODEBUILD := $(if $(CI),,node ../../scripts/dev/queue.mts node scripts/swift-packages.mts) $(XCODEBUILD_COMMAND)
BUILD_FLAGS := -configuration "$(CONFIGURATION)" CODE_SIGNING_ALLOWED=NO
CATALYST_TEST_FLAGS := -destination "platform=macOS,variant=Mac Catalyst" CODE_SIGN_IDENTITY=- CODE_SIGN_ENTITLEMENTS= DEVELOPMENT_TEAM= MACOSX_DEPLOYMENT_TARGET=27.0
TEST_ON_DESTINATION := $(if $(TEST_DESTINATION),$(XCODEBUILD) -destination "$(TEST_DESTINATION)",node scripts/with-simulator.mts $(XCODEBUILD_COMMAND))

.PHONY: build build-ios test test-simulator ui-test format format-check strings-check formatting-check check

build: build-ios

build-ios:
	$(XCODEBUILD) -scheme "$(APP_SCHEME)" $(BUILD_FLAGS) -destination "generic/platform=iOS" build

test: ONLY_TESTING ?= ZoonkTests
test:
	$(if $(TEST_DESTINATION),$(XCODEBUILD) -destination "$(TEST_DESTINATION)" CODE_SIGNING_ALLOWED=NO,$(XCODEBUILD) $(CATALYST_TEST_FLAGS)) -scheme "$(UNIT_TEST_SCHEME)" -parallel-testing-enabled NO -only-testing:"$(ONLY_TESTING)" test

test-simulator: ONLY_TESTING ?= ZoonkTests
test-simulator:
	$(TEST_ON_DESTINATION) -scheme "$(UNIT_TEST_SCHEME)" CODE_SIGNING_ALLOWED=NO -parallel-testing-enabled NO -only-testing:"$(ONLY_TESTING)" test

ui-test: ONLY_TESTING ?= ZoonkUITests
ui-test:
	$(TEST_ON_DESTINATION) -scheme "$(APP_SCHEME)" CODE_SIGNING_ALLOWED=NO -parallel-testing-enabled NO -only-testing:"$(ONLY_TESTING)" test

format:
	xcrun swift-format format --recursive --in-place $(SWIFT_SOURCES)

format-check:
	xcrun swift-format lint --recursive --parallel --strict $(SWIFT_SOURCES)

strings-check:
	node scripts/check-strings.mts

formatting-check:
	node scripts/check-formatting.mts

check: format-check formatting-check test
	$(MAKE) strings-check
