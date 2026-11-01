plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.onboarding"
}

dependencies {
    implementation(project(":feature:plan"))

    implementation(libs.androidx.compose.material3.adaptive)
    implementation(libs.androidx.core)

    testImplementation(testFixtures(project(":feature:account")))
    testImplementation(testFixtures(project(":feature:plan")))
    testImplementation(libs.androidx.window.testing)
}
