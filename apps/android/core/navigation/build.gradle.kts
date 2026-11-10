plugins {
    id("zoonk.android.library")
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.zoonk.android.navigation"
    testFixtures.enable = true
}

dependencies {
    implementation(project(":core:resources"))
    // Routes are Navigation 3 keys, and the navigator hands out its back stacks.
    api(libs.androidx.navigation3.runtime)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.annotation)
    implementation(libs.androidx.browser)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.core)
    implementation(libs.androidx.lifecycle.viewmodel.navigation3)
    implementation(libs.kotlinx.serialization.core)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)
}
