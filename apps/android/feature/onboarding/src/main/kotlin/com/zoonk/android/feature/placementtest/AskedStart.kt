package com.zoonk.android.feature.placementtest

import com.zoonk.android.data.Visit

/**
 * A test the learner asked for before its screen opened, which the screen starts on its own once per [visit] while
 * no other save is on its way. It belongs to the visit: a learner who comes back, or whose app comes back from
 * process death, sees it start again rather than a spinner with nothing on its way.
 */
internal class AskedStart(
    private val visit: Visit,
) {
    private var tried = -1

    /** Whether to start now; [busy] says another save is on its way, whose answer the screen waits for first. */
    fun take(busy: Boolean): Boolean {
        if (busy || tried == visit.number) return false
        tried = visit.number
        return true
    }
}
