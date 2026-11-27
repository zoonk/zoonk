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

    testImplementation(testFixtures(project(":feature:conversation")))
    testImplementation(testFixtures(project(":feature:plan")))
}

val writingLineCases = rootProject.file("../../packages/core/src/exams/essays/_test-utils/writing-lines.json")

tasks.withType<Test>().configureEach {
    inputs.file(writingLineCases)
    systemProperty("zoonk.writingLines", writingLineCases.absolutePath)
}
