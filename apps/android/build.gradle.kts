plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.compose.compiler) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.spotless)
}

spotless {
    kotlin {
        target("app/src/**/*.kt", "lint-checks/src/**/*.kt")
        ktlint()
    }

    kotlinGradle {
        target("*.gradle.kts", "app/*.gradle.kts", "lint-checks/*.gradle.kts")
        ktlint()
    }

    format("misc") {
        target(".editorconfig", ".gitignore", "*.properties", "gradle/**/*.properties")
        trimTrailingWhitespace()
        endWithNewline()
    }
}
