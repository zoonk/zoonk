import io.sentry.android.gradle.extensions.InstrumentationFeature

plugins {
    id("zoonk.android.application")
    alias(libs.plugins.aboutlibraries.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.sentry.android)
}

android {
    // The resources module took `com.zoonk.android`, so its `R` keeps that name.
    namespace = "com.zoonk.android.app"

    defaultConfig {
        applicationId = "com.zoonk"
        versionCode = providers.gradleProperty("zoonk.versionCode").get().toInt()
        versionName = providers.gradleProperty("zoonk.versionName").get()
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isPseudoLocalesEnabled = true
            buildConfigField("String", "SENTRY_DSN", "\"\"")
        }

        release {
            buildConfigField("String", "SENTRY_DSN", "\"${providers.gradleProperty("sentryDsn").getOrElse("")}\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        checkDependencies = true
    }

    androidResources {
        generateLocaleConfig = true
        // Keeps libraries' translations to the app's languages, so our strings that replace theirs (close_sheet)
        // aren't outranked by a library's regional copy, such as Compose's pt-rBR "Fechar planilha".
        localeFilters +=
            listOf("en") +
            file("../core/resources/src/main/res").list().orEmpty().mapNotNull {
                Regex("values-([a-z]{2,3})").matchEntire(it)?.groupValues?.get(1)
            }
    }
}

sentry {
    ignoredBuildTypes = setOf("debug")
    org = "zoonk"
    projectName = "zoonk-android"
    // Without the token (CI, other Macs) the build still embeds the mapping's id and skips the upload.
    authToken = providers.environmentVariable("SENTRY_AUTH_TOKEN")
    autoUploadProguardMapping = authToken.map { it.isNotBlank() }.orElse(false)
    telemetry = false
    autoInstallation.enabled = false
    tracingInstrumentation {
        // File paths can name a learner's files, and logcat lines from libraries can carry signed URLs.
        features = setOf(InstrumentationFeature.OKHTTP)
        logcat.enabled = false
    }
}

aboutLibraries {
    // Online, the plugin downloads license texts with no timeout and caches whatever came back, so the
    // texts it needs are committed under aboutlibraries/licenses, with abcjs's glyphs, which the app copies.
    offlineMode = true
    collect.configPath = layout.projectDirectory.dir("aboutlibraries")
}

dependencies {
    // First, so our strings that replace a library's (close_sheet) win the resource merge.
    implementation(project(":core:resources"))
    implementation(project(":core:navigation"))
    implementation(project(":core:data"))
    implementation(project(":core:designsystem"))
    implementation(project(":core:ui"))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.annotation)
    implementation(libs.androidx.lifecycle.runtime.compose)

    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material3.adaptive.navigation.suite)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.commonmark)
    implementation(libs.commonmark.ext.gfm.strikethrough)
    implementation(libs.commonmark.ext.gfm.tables)

    // Navigation, routes and the adaptive shell.
    implementation(libs.androidx.browser)
    implementation(libs.androidx.compose.material3.adaptive)
    implementation(libs.androidx.compose.material3.adaptive.layout)
    implementation(libs.androidx.compose.material3.adaptive.navigation)
    implementation(libs.androidx.compose.material3.adaptive.navigation3)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.viewmodel.navigation3)
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.core)

    implementation(project(":api"))
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.androidx.datastore)
    implementation(libs.androidx.datastore.tink)
    implementation(libs.okhttp.sse)
    implementation(libs.tink.android)

    // Account and Plus.
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.billing.ktx)
    implementation(libs.googleid)
    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.play.integrity)
    implementation(libs.aboutlibraries.core)

    // Speech clips and recorded answers.
    implementation(libs.androidx.media3.exoplayer)

    // Live calls.
    implementation(libs.webrtc)

    // Code sandbox.
    implementation(libs.androidx.webkit)

    // Crash and error reports.
    implementation(libs.sentry.android)
    implementation(libs.sentry.okhttp)

    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.leakcanary.android)

    testImplementation(testFixtures(project(":core:data")))
    testImplementation(testFixtures(project(":core:navigation")))
    testImplementation(composeBom)
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver3)

    androidTestImplementation(composeBom)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
}
