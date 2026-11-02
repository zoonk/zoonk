plugins {
    alias(libs.plugins.aboutlibraries.android) apply false
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.compose.compiler) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.openapi.generator) apply false
    alias(libs.plugins.sentry.android) apply false
    alias(libs.plugins.spotless)
}

// Globs rooted at each module, never `**/`: a `**` glob walks every build folder, and reading one while a
// compile task writes class files into it fails the check.
val modules = listOf("app", "api", "lint-checks", "core/*", "feature/*", "build-logic/*")

spotless {
    kotlin {
        target(modules.map { "$it/src/**/*.kt" })
        ktlint()
    }

    kotlinGradle {
        target(listOf("*.gradle.kts", "build-logic/*.gradle.kts") + modules.map { "$it/*.gradle.kts" })
        ktlint()
    }

    format("misc") {
        target(".editorconfig", ".gitignore", "*.properties", "gradle/**/*.properties")
        trimTrailingWhitespace()
        endWithNewline()
    }
}
