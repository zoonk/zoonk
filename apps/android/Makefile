GRADLEW := ./gradlew
GRADLE_ARGUMENTS ?= --console=plain
DEFAULT_ANDROID_SDK := $(firstword $(wildcard $(HOME)/Library/Android/sdk $(HOME)/Android/Sdk))
ANDROID_HOME ?= $(DEFAULT_ANDROID_SDK)
export ANDROID_HOME

# The Android workflow runs lint, test, and build as parallel jobs; check runs them in one build.
LINT_TASKS := spotlessCheck :app:lintRelease :lint-checks:test
TEST_TASKS := :app:testDebugUnitTest
BUILD_TASKS := :app:assembleRelease

.PHONY: build test ui-test lint format check

build:
	$(GRADLEW) $(GRADLE_ARGUMENTS) $(BUILD_TASKS)

test:
	$(GRADLEW) $(GRADLE_ARGUMENTS) $(TEST_TASKS)

ui-test:
	$(GRADLEW) $(GRADLE_ARGUMENTS) :app:connectedDebugAndroidTest

lint:
	$(GRADLEW) $(GRADLE_ARGUMENTS) $(LINT_TASKS)

format:
	$(GRADLEW) $(GRADLE_ARGUMENTS) spotlessApply

check:
	$(GRADLEW) $(GRADLE_ARGUMENTS) $(LINT_TASKS) $(TEST_TASKS) $(BUILD_TASKS)
