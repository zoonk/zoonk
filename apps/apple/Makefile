PROJECT := Zoonk.xcodeproj
APP_SCHEME := Zoonk
CONFIGURATION ?= Release
TEST_DESTINATION ?= platform=iOS Simulator,name=iPhone 17,OS=latest
TEST_ARGUMENTS ?=
XCODEBUILD := xcodebuild -quiet -project "$(PROJECT)"
BUILD_FLAGS := -configuration "$(CONFIGURATION)" CODE_SIGNING_ALLOWED=NO

.PHONY: build build-ios test format format-check check

build: build-ios

build-ios:
	$(XCODEBUILD) -scheme "$(APP_SCHEME)" $(BUILD_FLAGS) -destination "generic/platform=iOS" build

test:
	$(XCODEBUILD) -scheme "$(APP_SCHEME)" -destination "$(TEST_DESTINATION)" CODE_SIGNING_ALLOWED=NO $(TEST_ARGUMENTS) test

format:
	xcrun swift-format format --recursive --in-place .

format-check:
	xcrun swift-format lint --recursive --parallel --strict .

check: format-check build test
