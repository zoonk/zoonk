plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.catalog"
}

dependencies {
    implementation(project(":feature:account"))
    implementation(project(":feature:onboarding"))
    implementation(project(":feature:today"))

    implementation(libs.androidx.compose.material3.adaptive)
    implementation(libs.androidx.compose.material3.adaptive.layout)
    implementation(libs.coil.compose)

    testImplementation(testFixtures(project(":feature:account")))
}
