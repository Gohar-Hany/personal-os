import { currentMonth, getAccounts, getMonthSummary, getTransactions } from "@/lib/finance/financeService"
import { getGoldOverview } from "@/lib/finance/goldService"
import { serialize } from "@/lib/utils"
import { FinanceClient } from "@/components/finance/FinanceClient"

export const dynamic = "force-dynamic"

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const requested = (await searchParams).month
  const thisMonth = await currentMonth()
  const month = requested && /^\d{4}-\d{2}$/.test(requested) && requested <= thisMonth ? requested : thisMonth

  const [accounts, transactions, summary, gold] = await Promise.all([
    getAccounts(),
    getTransactions({ month }),
    getMonthSummary(month),
    // Gold is an extra: if it fails, the rest of the Money page still loads
    getGoldOverview().catch((err) => {
      console.warn("[gold] unavailable:", (err as Error).message)
      return null
    }),
  ])

  return <FinanceClient accounts={serialize(accounts)} transactions={serialize(transactions)} summary={summary} month={month} gold={gold && serialize(gold)} />
}
