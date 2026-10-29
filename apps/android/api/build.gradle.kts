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
        // The generated code calls deprecated JDK constructors (URL(String)).
        allWarningsAsErrors.set(false)
    }
}

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
    // The contract's integers have no format, and epoch milliseconds (`readAt`) overflow an Int. An
    // empty object (some language exercises' `content`) would be `kotlin.Any`, which can't decode.
    typeMappings = mapOf("AnyType" to "JsonElement", "object" to "JsonElement", "integer" to "kotlin.Long", "number" to "kotlin.Double")
    importMappings = mapOf("JsonElement" to "kotlinx.serialization.json.JsonElement")
    // Unions of JSON values the generator can't express; a new one fails compilation, so add it here.
    schemaMappings =
        listOf(
            "ExamTopicFrequency",
            // Its keys are required even when null (no score, a pass not known yet), which the model would drop.
            "ExamResultInput",
            "LanguageLevelTestSpokenAnswerRequest",
            // Its explicit nulls mean "clear it" (no daily limit, no active goal), which the model can't tell from absent.
            "LearningProfileUpdate",
            "MeDeletion",
            // Its `answer` is required even when null (a blank answer), which the model would drop.
            "MockAnswerInput",
            // Its `setTargetDate` takes an explicit null (no date), which the generated models would drop.
            "PlanChangeInput",
            "PronunciationAnswerRequest",
            "SpokenAnswerRequest",
            "__schema0",
            "__schema1",
        ).associateWith { "kotlinx.serialization.json.JsonElement" }
    // The plugin passes its own supporting-file list, which skips any ignore file; the app builds its
    // own client, so only the serializers the models use are listed.
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
