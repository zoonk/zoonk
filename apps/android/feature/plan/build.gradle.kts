plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.plan"
    testFixtures.enable = true
}

dependencies {
    implementation(project(":feature:account"))
    implementation(project(":feature:conversation"))

    implementation(libs.androidx.compose.material3.adaptive)
    implementation(libs.androidx.compose.material3.adaptive.navigation.suite)
    implementation(libs.androidx.compose.material3.adaptive.navigation3)
    implementation(libs.coil.compose)

    testFixturesImplementation(project(":core:data"))
    testFixturesImplementation(testFixtures(project(":core:data")))
    testFixturesImplementation(platform(libs.androidx.compose.bom))
    testFixturesImplementation(libs.androidx.compose.runtime)

    testImplementation(testFixtures(project(":feature:conversation")))
    testImplementation(libs.androidx.window.testing)
}
