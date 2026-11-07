import java.util.Properties

plugins {
    id("zoonk.android.library")
    alias(libs.plugins.kotlin.serialization)
}

// Written by `pnpm dev`; without it, `pnpm dev:direct`'s port.
val localApiBaseUrl =
    providers
        .fileContents(layout.projectDirectory.file("../../local-development.properties"))
        .asText
        .map { Properties().apply { load(it.reader()) }.getProperty("apiBaseUrl") }
        .orElse("http://localhost:4000")

fun environment(name: String) = "\"${providers.environmentVariable(name).getOrElse("")}\""

android {
    namespace = "com.zoonk.android.data"

    defaultConfig {
        // Google's Web client, the audience Zoonk's API accepts; without it there's no Google button.
        buildConfigField("String", "GOOGLE_SERVER_CLIENT_ID", environment("GOOGLE_SERVER_CLIENT_ID"))
        buildConfigField("String", "APPLE_CLIENT_ID", environment("APPLE_CLIENT_ID"))
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"${localApiBaseUrl.get()}\"")
            // The API refuses tokens for `com.zoonk.debug`, so a debug build sends none rather than spend Google decodes.
            buildConfigField("String", "PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER", "\"\"")
            buildConfigField("String", "VERSION_NAME", "\"${providers.gradleProperty("zoonk.versionName").get()}-debug\"")
        }

        release {
            buildConfigField("String", "API_BASE_URL", "\"https://api.zoonk.com\"")
            buildConfigField("String", "PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER", environment("PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER"))
            buildConfigField("String", "VERSION_NAME", "\"${providers.gradleProperty("zoonk.versionName").get()}\"")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    testFixtures.enable = true
}

dependencies {
    implementation(project(":core:resources"))
    api(project(":core:navigation"))
    api(project(":api"))

    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.annotation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.core)
    implementation(libs.androidx.lifecycle.process)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)

    // API runtime, session and private pictures.
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.datastore)
    implementation(libs.androidx.datastore.tink)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.okhttp.sse)
    implementation(libs.tink.android)
    releaseImplementation(libs.sentry.okhttp)

    // Account and Plus.
    implementation(libs.billing.ktx)
    implementation(libs.play.integrity)

    // Speech clips and recorded answers.
    implementation(libs.androidx.media3.exoplayer)

    // Live calls.
    implementation(libs.webrtc)

    // Code sandbox.
    implementation(libs.androidx.webkit)

    // Study reminder pushes.
    implementation(libs.firebase.messaging)

    testFixturesImplementation(composeBom)
    testFixturesImplementation(libs.androidx.compose.ui.test.junit4)
    testFixturesImplementation(libs.kotlinx.coroutines.test)
    testFixturesImplementation(libs.okhttp.mockwebserver3)

    testImplementation(composeBom)
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver3)
}
