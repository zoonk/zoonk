plugins {
    id("zoonk.jvm.library")
}

dependencies {
    compileOnly(libs.lint.api)
    testImplementation(libs.lint.api)
    testImplementation(libs.lint.tests)
    testImplementation(libs.junit)
}

tasks.jar {
    manifest {
        attributes("Lint-Registry-v2" to "com.zoonk.lint.ZoonkIssueRegistry")
    }
}
