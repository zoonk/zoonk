plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.activities"
    testFixtures.enable = true
}

dependencies {
    implementation(libs.androidx.core)
    implementation(libs.coil.compose)

    testFixturesImplementation(project(":core:data"))
}
