package com.zoonk.android.feature.mock.result

enum class MockResultPart { Score, Essays, Speaking, Plan }

/** The plan sits beside the steps where there's room for two panes. */
data class MockResultStepPart(
    val part: MockResultPart,
    val beside: Boolean,
)

private val BESIDE = setOf(MockResultPart.Plan)

fun resultSteps(has: Set<MockResultPart>): List<MockResultStepPart> =
    MockResultPart.entries.filter { it in has }.map { MockResultStepPart(it, it in BESIDE) }

fun resultAsideParts(has: Set<MockResultPart>): List<MockResultPart> = MockResultPart.entries.filter { it in has && it in BESIDE }
