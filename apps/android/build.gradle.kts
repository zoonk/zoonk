plugins {
    alias(libs.plugins.aboutlibraries.android) apply false
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.compose.compiler) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.openapi.generator) apply false
    alias(libs.plugins.spotless)
}

spotless {
    kotlin {
        target("**/src/**/*.kt")
        targetExclude("**/build/**", "**/node_modules/**")
        ktlint()
    }

    kotlinGradle {
        target("**/*.gradle.kts")
        targetExclude("**/build/**", "**/node_modules/**")
        ktlint()
    }

    format("misc") {
        target(".editorconfig", ".gitignore", "*.properties", "gradle/**/*.properties")
        trimTrailingWhitespace()
        endWithNewline()
    }
}
