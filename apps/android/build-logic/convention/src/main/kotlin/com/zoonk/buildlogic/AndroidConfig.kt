package com.zoonk.buildlogic

import com.android.build.api.dsl.CommonExtension
import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.services.BuildService
import org.gradle.api.services.BuildServiceParameters
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.getByType
import org.gradle.process.CommandLineArgumentProvider
import org.jetbrains.kotlin.compose.compiler.gradle.ComposeCompilerGradlePluginExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension
import java.io.File
import java.security.MessageDigest

/** What every Android module shares: SDKs, Kotlin, Compose, lint and the JVM unit tests. */
internal fun Project.configureAndroid(android: CommonExtension) {
    pluginManager.apply("org.jetbrains.kotlin.plugin.compose")
    val runsTests = runsTestsInShard()
    // Each module's tests boot Robolectric in a JVM of their own, and one per core starves the machine.
    val testJvms =
        gradle.sharedServices.registerIfAbsent("unitTestJvms", TestJvms::class.java) {
            maxParallelUsages.set((Runtime.getRuntime().availableProcessors() / 2).coerceAtLeast(1))
        }

    android.apply {
        compileSdk { version = release(COMPILE_SDK) { minorApiLevel = COMPILE_SDK_MINOR } }
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
                test.usesService(testJvms)
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
                // A module's tests share one JVM, which spends most of its time booting Robolectric's sandboxes:
                // C2 compilation costs more than it saves there, and C1 alone would shrink the code cache to 48 MB.
                test.jvmArgs("-XX:TieredStopAtLevel=1", "-XX:ReservedCodeCacheSize=240m")
                test.maxHeapSize = "2g"
                test.enabled = runsTests
                // Review screenshots are written only on demand: `-Pzoonk.shots=<folder>`.
                val shots = providers.gradleProperty("zoonk.shots").getOrElse("")
                test.systemProperty("zoonk.shots", shots)
                // Each picture's layout file names the build it came from, read when the tests run.
                if (shots.isNotEmpty()) test.jvmArgumentProviders.add(buildIdentity())
            }
        }
    }

    extensions.configure<KotlinAndroidProjectExtension> { configureKotlin(this, compilerOptions) }

    extensions.configure<ComposeCompilerGradlePluginExtension> {
        stabilityConfigurationFiles.add(rootProject.layout.projectDirectory.file("compose-stability.conf"))
    }

    val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")
    dependencies {
        "lintChecks"(project(":lint-checks"))
        constraints {
            // Compose UI test still brings Espresso 3.5, whose input injection fails on API 37:
            // https://github.com/android/android-test/issues/2507
            "testImplementation"(libs.findLibrary("androidx-test-espresso-core").get())
        }
    }
}

/** CI spreads the modules' tests over several machines: `-Pzoonk.testShard=<n>/<count>` runs every count-th module's. */
private fun Project.runsTestsInShard(): Boolean {
    val shard = providers.gradleProperty("zoonk.testShard").orNull ?: return true
    val (index, count) = shard.split("/").map(String::toInt)
    return rootProject.subprojects
        .map { it.path }
        .sorted()
        .indexOf(path) % count == index - 1
}

private const val COMPILE_SDK = 37
private const val COMPILE_SDK_MINOR = 2
internal const val TARGET_SDK = 37
private const val MIN_SDK = 26

internal abstract class TestJvms : BuildService<BuildServiceParameters.None>

/**
 * The checkout the tests run from: its commit and a digest of what isn't committed (tracked changes and
 * untracked files), or "clean". Review pictures carry it, so a picture can be tied to its build.
 */
private fun Project.buildIdentity(): CommandLineArgumentProvider {
    val root = rootProject.layout.projectDirectory.asFile

    fun git(vararg args: String) =
        providers
            .exec {
                workingDir = root
                commandLine("git", *args)
            }.standardOutput.asBytes
    val commit = git("rev-parse", "HEAD")
    val changes = git("diff", "HEAD", "--binary")
    // `:/` is the repository's top: run from apps/android, `ls-files` would list only the files under it.
    val untracked = git("ls-files", "--others", "--exclude-standard", "--full-name", "-z", "--", ":/")
    val top = git("rev-parse", "--show-toplevel")
    return CommandLineArgumentProvider {
        val digest = MessageDigest.getInstance("SHA-256")
        val files = String(untracked.get()).split('\u0000').filter { it.isNotEmpty() }
        val repository = File(String(top.get()).trim())
        digest.update(changes.get())
        files.forEach { name ->
            digest.update(name.toByteArray())
            File(repository, name).takeIf { it.isFile }?.let { digest.update(it.readBytes()) }
        }
        val uncommitted =
            if (changes.get().isEmpty() &&
                files.isEmpty()
            ) {
                "clean"
            } else {
                digest.digest().joinToString("") { "%02x".format(it) }
            }
        listOf("-Dzoonk.build.commit=${String(commit.get()).trim()}", "-Dzoonk.build.uncommitted=$uncommitted")
    }
}
