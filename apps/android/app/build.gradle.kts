plugins {
    id("zoonk.android.application")
    alias(libs.plugins.aboutlibraries.android)
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
            buildConfigField("String", "POSTHOG_PROJECT_TOKEN", "\"\"")
            buildConfigField("String", "POSTHOG_HOST", "\"\"")
        }

        release {
            buildConfigField("String", "SENTRY_DSN", "\"${providers.gradleProperty("sentryDsn").getOrElse("")}\"")
            buildConfigField("String", "POSTHOG_PROJECT_TOKEN", "\"${providers.gradleProperty("posthogProjectToken").getOrElse("")}\"")
            buildConfigField("String", "POSTHOG_HOST", "\"${providers.gradleProperty("posthogHost").getOrElse("")}\"")
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
    // sentry-cli's saved login signs in every shell on the owner's Mac, so only `make release` uploads the
    // mapping; other release builds (every agent's check) embed its id and upload nothing.
    autoUploadProguardMapping = providers.gradleProperty("sentryUploadMapping").map { it.toBoolean() }.orElse(false)
    telemetry = false
    autoInstallation.enabled = false
    // Its instrumentation varies with Gradle's caches, so :core:data's release setup traces OkHttp in code:
    // https://github.com/getsentry/sentry-android-gradle-plugin/issues/1492
    tracingInstrumentation.enabled = false
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
    implementation(project(":feature:account"))
    implementation(project(":feature:activities"))
    implementation(project(":feature:catalog"))
    implementation(project(":feature:conversation"))
    implementation(project(":feature:exam"))
    implementation(project(":feature:onboarding"))
    implementation(project(":feature:plan"))
    implementation(project(":feature:practice"))
    implementation(project(":feature:player"))
    implementation(project(":feature:today"))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.annotation)
    implementation(libs.androidx.lifecycle.runtime.compose)

    val composeBom = platform(libs.androidx.compose.bom)
    implementation(composeBom)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material3.adaptive.navigation.suite)
    implementation(libs.androidx.compose.ui.tooling.preview)

    // Navigation, routes and the adaptive shell.
    implementation(libs.androidx.compose.material3.adaptive)
    implementation(libs.androidx.compose.material3.adaptive.navigation3)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.kotlinx.coroutines.android)

    implementation(project(":api"))
    implementation(libs.coil.compose)

    // The licenses screen.
    implementation(libs.aboutlibraries.core)

    // Crash and error reports.
    implementation(libs.sentry.android)

    // Product analytics.
    implementation(libs.posthog.android)

    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.leakcanary.android)

    testImplementation(testFixtures(project(":core:data")))
    testImplementation(testFixtures(project(":core:navigation")))
    testImplementation(testFixtures(project(":feature:account")))
    testImplementation(testFixtures(project(":feature:activities")))
    testImplementation(testFixtures(project(":feature:conversation")))
    testImplementation(testFixtures(project(":feature:plan")))
    testImplementation(composeBom)
    testImplementation(libs.androidx.compose.ui.test.junit4)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.androidx.window.testing)
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
