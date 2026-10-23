import { currentMonth, getAccounts, getMonthSummary, getTransactions } from "@/lib/finance/financeService"
import { serialize } from "@/lib/utils"
import { FinanceClient } from "@/components/finance/FinanceClient"

export const dynamic = "force-dynamic"

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const requested = (await searchParams).month
  const month = requested && /^\d{4}-\d{2}$/.test(requested) && requested <= currentMonth() ? requested : currentMonth()

  const [accounts, transactions, summary] = await Promise.all([
    getAccounts(),
    getTransactions({ month }),
    getMonthSummary(month),
  ])

  return <FinanceClient accounts={serialize(accounts)} transactions={serialize(transactions)} summary={summary} month={month} />
}
