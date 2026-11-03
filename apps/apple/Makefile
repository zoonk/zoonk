PROJECT := Zoonk.xcodeproj
APP_SCHEME := Zoonk
SWIFT_SOURCES := Zoonk ZoonkAPI/Package.swift ZoonkAPI/Sources ZoonkTests ZoonkUITests
CONFIGURATION ?= Debug
XCODEBUILD_ARGUMENTS ?=
# The WebRTC package is a binary download; with the default Keychain credential lookup, xcodebuild
# can wait forever on a Keychain prompt in non-interactive shells. Public downloads need no login.
# Builds stay in the checkout, so removing an agent's worktree removes them too.
XCODEBUILD_COMMAND := xcodebuild -quiet -skipPackagePluginValidation -packageAuthorizationProvider netrc -derivedDataPath DerivedData/Make $(XCODEBUILD_ARGUMENTS) -project "$(PROJECT)"
XCODEBUILD := $(if $(CI),,node ../../scripts/dev/queue.mts) $(XCODEBUILD_COMMAND)
BUILD_FLAGS := -configuration "$(CONFIGURATION)" CODE_SIGNING_ALLOWED=NO
TEST_ON_DESTINATION := $(if $(TEST_DESTINATION),$(XCODEBUILD) -destination "$(TEST_DESTINATION)",node scripts/with-simulator.mts $(XCODEBUILD_COMMAND))

.PHONY: build build-ios test ui-test format format-check strings-check check

build: build-ios

build-ios:
	$(XCODEBUILD) -scheme "$(APP_SCHEME)" $(BUILD_FLAGS) -destination "generic/platform=iOS" build

test: ONLY_TESTING ?= ZoonkTests
ui-test: ONLY_TESTING ?= ZoonkUITests
test ui-test:
	$(TEST_ON_DESTINATION) -scheme "$(APP_SCHEME)" CODE_SIGNING_ALLOWED=NO -parallel-testing-enabled NO -only-testing:"$(ONLY_TESTING)" test

format:
	xcrun swift-format format --recursive --in-place $(SWIFT_SOURCES)

format-check:
	xcrun swift-format lint --recursive --parallel --strict $(SWIFT_SOURCES)

strings-check:
	node scripts/check-strings.mts

check: format-check test
	$(MAKE) strings-check
