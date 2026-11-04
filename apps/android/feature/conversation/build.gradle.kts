plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.conversation"
    testFixtures.enable = true
}

dependencies {
    implementation(libs.androidx.compose.material3.adaptive)
    implementation(libs.androidx.core)
    implementation(libs.coil.compose)

    testFixturesImplementation(project(":core:data"))
    testFixturesImplementation(testFixtures(project(":core:data")))

    testImplementation(libs.androidx.window.testing)
}
