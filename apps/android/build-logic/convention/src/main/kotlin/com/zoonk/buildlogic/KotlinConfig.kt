package com.zoonk.buildlogic

import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinBaseExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinJvmCompilerOptions

internal fun configureKotlin(
    kotlin: KotlinBaseExtension,
    options: KotlinJvmCompilerOptions,
) {
    kotlin.jvmToolchain(JDK)
    options.jvmTarget.set(JvmTarget.JVM_17)
    options.allWarningsAsErrors.set(true)
}

private const val JDK = 25
