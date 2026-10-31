package com.zoonk.buildlogic

import com.android.build.api.dsl.CommonExtension
import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.jetbrains.kotlin.compose.compiler.gradle.ComposeCompilerGradlePluginExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension

/** What every Android module shares: SDKs, Kotlin, Compose, lint and the JVM unit tests. */
internal fun Project.configureAndroid(android: CommonExtension) {
    pluginManager.apply("org.jetbrains.kotlin.plugin.compose")

    android.apply {
        compileSdk = COMPILE_SDK
        defaultConfig.minSdk = MIN_SDK
        defaultConfig.testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildFeatures.compose = true

        compileOptions.sourceCompatibility = JavaVersion.VERSION_17
        compileOptions.targetCompatibility = JavaVersion.VERSION_17

        lint.apply {
            abortOnError = true
            lintConfig = rootProject.file("lint.xml")
            warningsAsErrors = true
            // With warnings as errors, these newer-version checks would fail an unchanged tree whenever a release ships.
            disable +=
                setOf(
                    "AndroidGradlePluginVersion",
                    "GradleDependency",
                    "NewerVersionAvailable",
                    "OldTargetApi",
                    // A check for lint-rule authors; :lint-checks keeps it.
                    "UElementAsPsi",
                )
        }

        testOptions.apply {
            animationsDisabled = true
            unitTests.isIncludeAndroidResources = true
            unitTests.all { test ->
                // Robolectric reaches into the JDK's internals.
                test.jvmArgs(
                    "--add-opens=java.base/java.lang=ALL-UNNAMED",
                    "--add-opens=java.base/java.util=ALL-UNNAMED",
                    "--add-opens=java.base/java.io=ALL-UNNAMED",
                    "--add-opens=java.base/java.net=ALL-UNNAMED",
                    "--add-opens=java.base/java.security=ALL-UNNAMED",
                    "--add-opens=java.base/java.text=ALL-UNNAMED",
                    "--add-opens=java.base/jdk.internal.access=ALL-UNNAMED",
                    "--add-opens=java.desktop/java.awt.font=ALL-UNNAMED",
                )
                test.maxHeapSize = "2g"
                test.maxParallelForks = providers.gradleProperty("zoonk.testForks").getOrElse("1").toInt()
                // Review screenshots are written only on demand: `-Pzoonk.shots=<folder>`.
                test.systemProperty("zoonk.shots", providers.gradleProperty("zoonk.shots").getOrElse(""))
            }
        }
    }

    extensions.configure<KotlinAndroidProjectExtension> { configureKotlin(this, compilerOptions) }

    extensions.configure<ComposeCompilerGradlePluginExtension> {
        stabilityConfigurationFiles.add(rootProject.layout.projectDirectory.file("compose-stability.conf"))
    }

    dependencies {
        "lintChecks"(project(":lint-checks"))
    }
}

private const val COMPILE_SDK = 37
private const val MIN_SDK = 26
