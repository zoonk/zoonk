plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.today"
}

dependencies {
    implementation(project(":feature:account"))
    implementation(project(":feature:exam"))
    implementation(project(":feature:onboarding"))
    implementation(project(":feature:plan"))
    implementation(project(":feature:player"))

    implementation(libs.androidx.compose.material3.adaptive)

    testImplementation(testFixtures(project(":feature:plan")))
    testImplementation(libs.androidx.window.testing)
}
