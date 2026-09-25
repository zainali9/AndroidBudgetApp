package com.example.mybudgetapp

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NavigationTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Before fun keepScreenAwakeDuringTest() {
        // Applies to this test activity only; does not change the phone's settings.
        compose.runOnUiThread {
            compose.activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    @Test fun tabsAndBackNavigateWithoutLosingMonth() {
        val previousMonth = YearMonth.now().minusMonths(1)
            .format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH))
        compose.onNodeWithContentDescription("Previous month").performClick()
        compose.onNodeWithContentDescription("Transactions tab").performClick()
        compose.onNodeWithText("No transactions").assertIsDisplayed()
        compose.onNodeWithText(previousMonth).assertIsDisplayed()
        compose.onNodeWithContentDescription("Budgets tab").performClick()
        compose.onNodeWithText("No budget plan").assertIsDisplayed()
        compose.onNodeWithContentDescription("Accounts tab").performClick()
        compose.onNodeWithText("Your money, in one place").assertIsDisplayed()
        compose.onNodeWithContentDescription("Settings tab").performClick()
        compose.onNodeWithText("PKR · Pakistani rupee").assertIsDisplayed()
        compose.runOnUiThread { compose.activity.onBackPressedDispatcher.onBackPressed() }
        compose.onNodeWithContentDescription("Home tab").assertIsSelected()
        compose.onNodeWithText(previousMonth).assertIsDisplayed()
    }

    @Test fun selectedTabAndMonthSurviveActivityRecreation() {
        val previousMonth = YearMonth.now().minusMonths(1)
            .format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH))
        compose.onNodeWithContentDescription("Previous month").performClick()
        compose.onNodeWithContentDescription("Budgets tab").performClick()
        compose.activityRule.scenario.recreate()
        compose.onNodeWithContentDescription("Budgets tab").assertIsSelected()
        compose.onNodeWithText(previousMonth).assertIsDisplayed()
    }

    @Test fun expensePreviewOpensAndClosesWithoutSaving() {
        compose.onNodeWithContentDescription("Add expense").performClick()
        compose.onNodeWithText("Expense entry is coming soon. This preview shows what you will be able to record; nothing is saved yet.").assertIsDisplayed()
        compose.onNodeWithText("Got it").performScrollTo().performClick()
        compose.onNodeWithText("Got it").assertDoesNotExist()
        compose.onNodeWithText("PKR 23,000.00").assertIsDisplayed()
    }
}
