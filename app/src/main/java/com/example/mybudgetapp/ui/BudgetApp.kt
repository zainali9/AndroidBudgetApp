package com.example.mybudgetapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.mybudgetapp.R
import com.example.mybudgetapp.ui.theme.MyBudgetAppTheme
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class Destination(val label: String, val icon: Int) {
    HOME("Home", R.drawable.ic_home),
    TRANSACTIONS("Transactions", R.drawable.ic_transactions),
    BUDGETS("Budgets", R.drawable.ic_budgets),
    ACCOUNTS("Accounts", R.drawable.ic_accounts),
    SETTINGS("Settings", R.drawable.ic_settings),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetApp() {
    // Keep UI choices through activity recreation. This is not financial data storage.
    var selectedTab by rememberSaveable { mutableStateOf(Destination.HOME.name) }
    var selectedMonth by rememberSaveable { mutableStateOf(YearMonth.now().toString()) }
    val sampleMonthText = rememberSaveable { YearMonth.now().toString() }
    var showExpensePreview by rememberSaveable { mutableStateOf(false) }
    val destination = Destination.valueOf(selectedTab)
    val month = YearMonth.parse(selectedMonth)
    val budgets = sampleBudgetsFor(month, YearMonth.parse(sampleMonthText))

    BackHandler(enabled = destination != Destination.HOME && !showExpensePreview) {
        selectedTab = Destination.HOME.name
    }

    Scaffold(
        topBar = {
            TopAppBar(title = {
                Column {
                    Text("My Budget", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(destination.label, style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            })
        },
        bottomBar = {
            NavigationBar {
                Destination.entries.forEach { item ->
                    NavigationBarItem(
                        selected = destination == item,
                        onClick = { selectedTab = item.name },
                        icon = { Icon(painterResource(item.icon), contentDescription = null) },
                        label = { Text(item.label, maxLines = 1) },
                        modifier = Modifier.semantics { contentDescription = "${item.label} tab" },
                    )
                }
            }
        },
        floatingActionButton = {
            if (destination == Destination.HOME || destination == Destination.TRANSACTIONS) {
                FloatingActionButton(
                    onClick = { showExpensePreview = true },
                    modifier = Modifier.semantics { contentDescription = "Add expense" },
                ) {
                    Icon(painterResource(R.drawable.ic_add), contentDescription = null)
                }
            }
        },
    ) { innerPadding ->
        // Each tab owns its scroll position, so switching tabs does not share an offset.
        androidx.compose.runtime.saveable.rememberSaveableStateHolder().SaveableStateProvider(selectedTab) {
            Column(
                modifier = Modifier.fillMaxSize().padding(innerPadding)
                    .consumeWindowInsets(innerPadding).verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp).padding(top = 8.dp, bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                SampleNotice()
                if (destination in listOf(Destination.HOME, Destination.TRANSACTIONS, Destination.BUDGETS)) {
                    MonthSelector(month = month, onChange = { selectedMonth = it.toString() })
                }
                when (destination) {
                    Destination.HOME -> HomeScreen(budgets)
                    Destination.TRANSACTIONS -> TransactionsScreen(month == YearMonth.parse(sampleMonthText))
                    Destination.BUDGETS -> BudgetsScreen(budgets)
                    Destination.ACCOUNTS -> AccountsScreen()
                    Destination.SETTINGS -> SettingsScreen()
                }
            }
        }
    }

    if (showExpensePreview) {
        ModalBottomSheet(onDismissRequest = { showExpensePreview = false }) {
            Column(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text("Add expense", style = MaterialTheme.typography.headlineSmall)
                Text("Expense entry is coming soon. This preview shows what you will be able to record; nothing is saved yet.")
                InfoRow("Amount", "PKR")
                InfoRow("Category", "Category and optional subtype")
                InfoRow("Paid with", "Account or card")
                InfoRow("Date & note", "Purchase date and optional note")
                Button(onClick = { showExpensePreview = false }, modifier = Modifier.fillMaxWidth()) {
                    Text("Got it")
                }
                Spacer(Modifier.height(12.dp))
            }
        }
    }
}

@Composable
private fun SampleNotice() {
    Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.medium) {
        Text("DESIGN PREVIEW · Sample data only", Modifier.fillMaxWidth().padding(12.dp),
            style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun MonthSelector(month: YearMonth, onChange: (YearMonth) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween) {
        IconButton(onClick = { onChange(month.minusMonths(1)) }) {
            Icon(painterResource(R.drawable.ic_previous), contentDescription = "Previous month")
        }
        Text(month.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH)),
            style = MaterialTheme.typography.titleMedium)
        IconButton(onClick = { onChange(month.plusMonths(1)) }) {
            Icon(painterResource(R.drawable.ic_next), contentDescription = "Next month")
        }
    }
}

@Composable
private fun HomeScreen(budgets: List<SampleBudget>) {
    Text("Your month at a glance", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Total expenses", style = MaterialTheme.typography.labelLarge)
            Text(pkr(budgets.sumOf { it.spentPaisa }), style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold)
            Text("${budgets.size} spending categories", style = MaterialTheme.typography.bodyMedium)
        }
    }
    Text("Budget overview", style = MaterialTheme.typography.titleLarge)
    if (budgets.isEmpty()) {
        EmptyCard("A fresh month", "No sample spending or budgets for this month. Switch back to the current month to explore the preview.")
    } else {
        budgets.sortedByDescending { it.plannedPaisa }.forEach { BudgetCard(it) }
    }
    Text("Your category pie chart will appear here when the spending dashboard is added.",
        color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun TransactionsScreen(hasSamples: Boolean) {
    Text("Money in & out", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Text("A single place for your income and purchases.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (!hasSamples) {
        EmptyCard("No transactions", "There are no sample transactions for the selected month.")
    } else {
        sampleTransactions.forEach { item ->
            Card {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(item.title, style = MaterialTheme.typography.titleMedium)
                    Text(item.detail, style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text((if (item.income) "+ " else "− ") + pkr(item.amountPaisa),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (item.income) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
                }
            }
        }
    }
}

@Composable
private fun BudgetsScreen(budgets: List<SampleBudget>) {
    Text("Give every rupee a plan", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Text("Category plans will track spending from their subcategories too.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    if (budgets.isEmpty()) {
        EmptyCard("No budget plan", "Monthly planning and copying a previous plan will be available in a later milestone.")
    } else {
        Text("Planned · ${pkr(budgets.sumOf { it.plannedPaisa })}", style = MaterialTheme.typography.titleMedium)
        budgets.sortedByDescending { it.plannedPaisa }.forEach { BudgetCard(it) }
    }
    Text("Coming soon: create a plan or copy a past month.", style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun BudgetCard(budget: SampleBudget) {
    val remaining = budget.plannedPaisa - budget.spentPaisa
    Card {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(budget.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("${pkr(budget.spentPaisa)} spent", style = MaterialTheme.typography.bodyLarge)
            LinearProgressIndicator(
                progress = { (budget.spentPaisa.toFloat() / budget.plannedPaisa).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(8.dp),
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
            Text("${pkr(remaining)} left of ${pkr(budget.plannedPaisa)}",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AccountsScreen() {
    Text("Your money, in one place", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    AccountCard("Bank account", "Available balance", 12500000, "Debit card linked to this account")
    AccountCard("Cash", "Available balance", 800000, "Money in your wallet")
    AccountCard("Credit card", "Amount owed", 450000, "Purchases increase debt; payments reduce it")
    Text("Coming soon: add your accounts and opening balances.", color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun AccountCard(name: String, label: String, amount: Long, detail: String) {
    Card {
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.labelLarge)
            Text(pkr(amount), style = MaterialTheme.typography.headlineSmall)
            Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SettingsScreen() {
    Text("Make it yours", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    InfoRow("Currency", "PKR · Pakistani rupee")
    InfoRow("Appearance", "Follows your phone's light or dark theme")
    InfoRow("Expense categories", "Coming soon: categories and optional subcategories")
    InfoRow("Income sources", "Coming soon: salary, freelance work, and more")
    InfoRow("Backup & restore", "Coming soon: export and restore your records")
    InfoRow("About this version", "Screen preview · No financial records are saved yet")
}

@Composable
private fun InfoRow(title: String, detail: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall)
        Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        HorizontalDivider(Modifier.padding(top = 12.dp))
    }
}

@Composable
private fun EmptyCard(title: String, detail: String) {
    OutlinedCard {
        Column(Modifier.fillMaxWidth().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 850)
@Composable
private fun BudgetAppPreview() {
    MyBudgetAppTheme { BudgetApp() }
}

@Preview(showBackground = true, widthDp = 393, heightDp = 850, uiMode = android.content.res.Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun BudgetAppDarkPreview() {
    MyBudgetAppTheme { BudgetApp() }
}
