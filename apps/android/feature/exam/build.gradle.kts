plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.exam"
}

dependencies {
    implementation(project(":feature:account"))
    implementation(project(":feature:activities"))
    implementation(project(":feature:conversation"))
    implementation(project(":feature:plan"))
    implementation(project(":feature:player"))

    implementation(libs.androidx.compose.material3.adaptive)

    testImplementation(libs.androidx.window.testing)
    testImplementation(testFixtures(project(":feature:conversation")))
    testImplementation(testFixtures(project(":feature:plan")))
}
