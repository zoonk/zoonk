package com.zoonk.android.navigation

import androidx.compose.runtime.Composable
import com.zoonk.android.feature.courses.CoursesScreen
import com.zoonk.android.feature.home.HomeScreen
import com.zoonk.android.feature.newcourse.NewCourseScreen
import com.zoonk.android.feature.progress.ProgressScreen

@Composable
fun AppDestinationContent(destination: AppDestination) {
    when (destination) {
        AppDestination.Home -> HomeScreen()
        AppDestination.NewCourse -> NewCourseScreen()
        AppDestination.Courses -> CoursesScreen()
        AppDestination.Progress -> ProgressScreen()
    }
}
