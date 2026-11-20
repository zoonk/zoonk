package com.zoonk.android.ui.format

/** Keep the dot with the next fact when the line wraps. */
const val FACT_SEPARATOR = " · "

/** Facts as one line, "Chapter 2 of 9 · 4 short lessons · 30 min", without the missing or empty ones. */
fun Iterable<String?>.factsLine(): String = filterNot { it.isNullOrEmpty() }.joinToString(FACT_SEPARATOR)

fun factsLine(vararg facts: String?): String = facts.asList().factsLine()
