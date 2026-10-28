import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.openapi.generator)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    jvmToolchain(25)
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        // The generated code calls a few deprecated JDK constructors (URL(String)); warnings stay
        // warnings here so a generator release can't fail the build on code we don't write.
        allWarningsAsErrors.set(false)
    }
}

// Generates the whole public API from the contract `pnpm openapi:generate` writes next to this file.
// Generation runs on build, so the client never drifts from `openapi.json`.
openApiGenerate {
    generatorName = "kotlin"
    library = "jvm-retrofit2"
    inputSpec = layout.projectDirectory.file("openapi.json")
    outputDir = layout.buildDirectory.dir("generated/openapi")
    templateDir = layout.projectDirectory.dir("templates")
    packageName = "com.zoonk.api"
    // The contract marks base64 strings with `contentEncoding`, a 3.1 keyword the 3.0 validator
    // rejects and the generator ignores.
    skipValidateSpec = true
    configOptions =
        mapOf(
            "serializationLibrary" to "kotlinx_serialization",
            "useCoroutines" to "true",
            "generateOneOfAnyOfWrappers" to "true",
            "dateLibrary" to "kotlinx-datetime",
            // An enum value is named `context`, a Kotlin soft keyword.
            "enumPropertyNaming" to "UPPERCASE",
        )
    // The contract's integers carry no format, and some are epoch milliseconds (`readAt`,
    // `nextChangeAt`), which overflow an Int. Long holds every integer JSON gives JavaScript.
    typeMappings = mapOf("AnyType" to "JsonElement", "integer" to "kotlin.Long", "number" to "kotlin.Double")
    importMappings = mapOf("JsonElement" to "kotlinx.serialization.json.JsonElement")
    // Unions of JSON values the generator can't express (recursive values, a value-or-object
    // choice). Callers build or read them as JSON. A new one fails compilation; add its name here.
    schemaMappings =
        listOf(
            "ExamTopicFrequency",
            "LanguageLevelTestSpokenAnswerRequest",
            "MeDeletion",
            "PronunciationAnswerRequest",
            "SpokenAnswerRequest",
            "__schema0",
            "__schema1",
        ).associateWith { "kotlinx.serialization.json.JsonElement" }
    // The app builds its own OkHttp client, Retrofit services and Json (ApiJson.kt), so only the
    // APIs, the models and the serializers they use are generated.
    globalProperties =
        mapOf(
            "apis" to "",
            "models" to "",
            "supportingFiles" to
                listOf(
                    "AtomicBooleanAdapter.kt",
                    "AtomicIntegerAdapter.kt",
                    "AtomicLongAdapter.kt",
                    "BigDecimalAdapter.kt",
                    "BigIntegerAdapter.kt",
                    "CollectionFormats.kt",
                    "Serializer.kt",
                    "StringBuilderAdapter.kt",
                    "URIAdapter.kt",
                    "URLAdapter.kt",
                    "UUIDAdapter.kt",
                ).joinToString(","),
        )
    cleanupOutput = true
    generateApiDocumentation = false
    generateApiTests = false
    generateModelDocumentation = false
    generateModelTests = false
}

sourceSets.main {
    kotlin.srcDir(tasks.openApiGenerate.map { it.outputDir.dir("src/main/kotlin") })
}

dependencies {
    api(libs.kotlinx.serialization.json)
    api(libs.kotlinx.datetime)
    api(libs.okhttp)
    api(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx.serialization)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver3)
}
