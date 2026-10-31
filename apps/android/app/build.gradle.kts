import java.util.Properties

plugins {
    id("zoonk.android.application")
    alias(libs.plugins.aboutlibraries.android)
    alias(libs.plugins.kotlin.serialization)
}

// Written by `pnpm dev`; without it, `pnpm dev:direct`'s port.
val localApiBaseUrl =
    providers
        .fileContents(layout.projectDirectory.file("../local-development.properties"))
        .asText
        .map { Properties().apply { load(it.reader()) }.getProperty("apiBaseUrl") }
        .orElse("http://localhost:4000")

android {
    // The resources module took `com.zoonk.android`, so its `R` keeps that name.
    namespace = "com.zoonk.android.app"

    defaultConfig {
        applicationId = "com.zoonk"
        versionCode = 1
        versionName = "0.1.0"
        // Google's Web client, the audience Zoonk's API accepts; without it there's no Google button.
        buildConfigField(
            "String",
            "GOOGLE_SERVER_CLIENT_ID",
            "\"${providers.environmentVariable("GOOGLE_SERVER_CLIENT_ID").getOrElse("")}\"",
        )
        buildConfigField("String", "APPLE_CLIENT_ID", "\"${providers.environmentVariable("APPLE_CLIENT_ID").getOrElse("")}\"")
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isPseudoLocalesEnabled = true
            buildConfigField("String", "API_BASE_URL", "\"${localApiBaseUrl.get()}\"")
            // The API refuses tokens for `com.zoonk.debug`, so a debug build sends none rather than spend Google decodes.
            buildConfigField("String", "PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER", "\"\"")
        }

        release {
            buildConfigField("String", "API_BASE_URL", "\"https://api.zoonk.com\"")
            buildConfigField(
                "String",
                "PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER",
                "\"${providers.environmentVariable("PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER").getOrElse("")}\"",
            )
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

    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.leakcanary.android)

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
