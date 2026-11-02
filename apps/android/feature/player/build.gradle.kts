plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.player"
}

dependencies {
    implementation(project(":feature:account"))
    implementation(project(":feature:activities"))
    implementation(project(":feature:onboarding"))
    implementation(project(":feature:plan"))

    implementation(libs.coil.compose)

    testImplementation(testFixtures(project(":feature:activities")))
    testImplementation(testFixtures(project(":feature:plan")))
    testImplementation(libs.androidx.window.testing)
}
