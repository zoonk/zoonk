plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.account"
    testFixtures.enable = true
}

dependencies {
    implementation(libs.androidx.browser)
    implementation(libs.androidx.compose.material3.adaptive)
    implementation(libs.androidx.compose.material3.adaptive.navigation.suite)
    implementation(libs.androidx.compose.material3.adaptive.navigation3)
    implementation(libs.androidx.core)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.coil.compose)
    implementation(libs.googleid)

    testImplementation(libs.androidx.window.testing)

    testFixturesImplementation(project(":core:data"))
    testFixturesImplementation(testFixtures(project(":core:data")))
    testFixturesImplementation(platform(libs.androidx.compose.bom))
    testFixturesImplementation(libs.androidx.compose.runtime)
}
