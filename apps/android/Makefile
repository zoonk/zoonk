GRADLEW := ./gradlew
GRADLE_ARGUMENTS ?= --console=plain
DEFAULT_ANDROID_SDK := $(firstword $(wildcard $(HOME)/Library/Android/sdk $(HOME)/Android/Sdk))
ANDROID_HOME ?= $(DEFAULT_ANDROID_SDK)
export ANDROID_HOME

.PHONY: build test ui-test lint format format-check check

build:
	$(GRADLEW) $(GRADLE_ARGUMENTS) :app:assembleRelease

test:
	$(GRADLEW) $(GRADLE_ARGUMENTS) :lint-checks:test :app:testDebugUnitTest

ui-test:
	$(GRADLEW) $(GRADLE_ARGUMENTS) :app:connectedDebugAndroidTest

lint:
	$(GRADLEW) $(GRADLE_ARGUMENTS) :app:lintRelease

format:
	$(GRADLEW) $(GRADLE_ARGUMENTS) spotlessApply

format-check:
	$(GRADLEW) $(GRADLE_ARGUMENTS) spotlessCheck

check:
	$(GRADLEW) $(GRADLE_ARGUMENTS) spotlessCheck :lint-checks:test :app:lintRelease :app:testDebugUnitTest :app:assembleRelease
