plugins {
    id("zoonk.android.feature")
}

android {
    namespace = "com.zoonk.android.feature.practice"
}

dependencies {
    implementation(project(":feature:account"))
    implementation(project(":feature:conversation"))
    implementation(project(":feature:exam"))
    implementation(project(":feature:plan"))
    implementation(project(":feature:player"))

    testImplementation(testFixtures(project(":feature:plan")))
}
