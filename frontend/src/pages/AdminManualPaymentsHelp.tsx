import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  Search,
  ShieldAlert,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react'

export function AdminManualPaymentsHelpPage() {
  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 print:bg-white print:py-4">
      <div className="max-w-3xl mx-auto space-y-6">

        <Link
          to="/admin/manual-payments"
          className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 print:hidden"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Manual Payments
        </Link>

        {/* Header */}
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 dark:bg-indigo-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            <BookOpen className="h-3.5 w-3.5" />
            Admin Reference
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            How to Verify a Manual Payment
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Always verify against your bank's real transaction record — never
            against a screenshot or the reference alone. Below is the exact
            process.
          </p>
        </header>

        {/* Important framing note */}
        <section className="rounded-2xl border border-amber-200 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <p className="font-bold mb-1">
                Format is not verification
              </p>
              <p>
                Our system checks that the reference <em>looks like</em>{' '}
                a valid reference (correct format for the bank). It
                cannot confirm the payment actually exists. A student
                could type any string matching the pattern.
              </p>
              <p className="mt-2">
                <strong>Your job is the real verification</strong> —
                open your bank app, find the transaction, match the
                reference, amount, and timestamp. Only approve after
                all three match.
              </p>
            </div>
          </div>
        </section>

        {/* The 3-step checklist */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            The 3-Step Check (do these in order)
          </h2>

          <ol className="space-y-4">
            <Step
              n={1}
              title="Match the reference number"
              body={
                <>
                  Open the admin card in the queue. Copy the reference
                  number (e.g.{' '}
                  <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-xs">
                    FT24ABC123XYZ
                  </code>
                  ). Open your bank app or SMS alerts. Find a matching
                  credit with <em>exactly</em> that reference.
                </>
              }
            />
            <Step
              n={2}
              title="Match the amount"
              body={
                <>
                  The amount you received in your bank must equal the plan
                  price shown on the admin card (
                  <em>down to the decimal</em>). If the student paid 50 but
                  the plan is 100, reject with the reason{' '}
                  <em>"Amount mismatch"</em>.
                </>
              }
            />
            <Step
              n={3}
              title="Sanity-check the timestamp"
              body={
                <>
                  The bank transaction should be from{' '}
                  <strong>today or yesterday</strong>. If it's from weeks
                  ago, the student likely reused an old receipt — reject
                  it.
                </>
              }
            />
          </ol>

          <div className="mt-5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>If all 3 match:</strong> click{' '}
              <strong>Approve &amp; Activate</strong>. The student's
              Premium is enabled instantly and they receive a confirmation
              email.
            </p>
          </div>
        </section>

        {/* Where to look in each bank */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Search className="h-5 w-5 text-indigo-600" />
            Where to find the transaction in each bank
          </h2>

          <div className="space-y-3">
            <BankHelpCard
              icon={<Building2 className="h-5 w-5" />}
              bank="CBE"
              color="emerald"
              options={[
                'CBE Birr app → Transactions / History',
                'CBE Mobile Banking → Account Statement',
                'SMS alert from CBE (sent on every deposit)',
                'Any CBE branch — ask for a passbook update',
                'Online: cbe.com.et → statement',
              ]}
              lookFor="A credit line containing the reference (starts with FT)."
            />
            <BankHelpCard
              icon={<Smartphone className="h-5 w-5" />}
              bank="Telebirr"
              color="purple"
              options={[
                'Telebirr app → History (tap any entry for details)',
                'SMS from 127 (sent on every deposit)',
                'Online: telebirr.et → transaction history',
              ]}
              lookFor="A 'Transfer received' entry with the phone number + amount."
            />
            <BankHelpCard
              icon={<Building2 className="h-5 w-5" />}
              bank="Awash Bank"
              color="amber"
              options={[
                'Awash Mobile app → Transactions',
                'SMS alert from Awash (sent on deposit)',
                'Online banking → account statement',
                'Any Awash branch — for reconciliation',
              ]}
              lookFor="A credit with the reference code in the description."
            />
          </div>
        </section>

        {/* Red flags */}
        <section className="rounded-2xl border-2 border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-rose-900 dark:text-rose-200 mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Red flags — reject immediately
          </h2>

          <ul className="space-y-2.5 text-sm text-rose-900 dark:text-rose-200">
            <Flag>Reference does not exist in your bank record at all.</Flag>
            <Flag>The transaction date is older than 3 days.</Flag>
            <Flag>Amount is less than the plan price.</Flag>
            <Flag>Same reference was submitted before (system blocks most, but double-check).</Flag>
            <Flag>Student cannot explain who sent the money when asked.</Flag>
            <Flag>Reference format is clearly made up (e.g. <code className="rounded bg-white/60 px-1">ABC123</code>).</Flag>
          </ul>

          <div className="mt-4 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-rose-200 dark:border-rose-500/30 p-3.5 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              <strong>When in doubt, do NOT approve.</strong> Click Reject
              with a clear reason. The student will email you, and you can
              investigate together before deciding.
            </p>
          </div>
        </section>

        {/* Worked example */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-600" />
            Worked example — a correct approval
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                What the student submitted
              </div>
              <dl className="space-y-1.5 text-xs">
                <Row label="Reference" value="FT24ABC123XYZ" mono />
                <Row label="Amount" value="100.00 ETB" />
                <Row label="Sender" value="Ebisa Tesfaye" />
                <Row label="Time" value="Sep 14, 3:42 PM" />
              </dl>
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                What your CBE Birr app shows
              </div>
              <dl className="space-y-1.5 text-xs">
                <Row label="Reference" value="FT24ABC123XYZ" mono ok />
                <Row label="Amount" value="+100.00 ETB" ok />
                <Row label="Sender" value="Ebisa Tesfaye" ok />
                <Row label="Time" value="Sep 14, 3:41 PM" ok />
              </dl>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
            Reference, amount, and time all match → <strong>Approve.</strong>{' '}
            Takes about 60 seconds from opening the bank app.
          </div>
        </section>

        {/* If unsure */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
            What if I'm not sure?
          </h2>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex gap-2">
              <span className="text-slate-400">1.</span>
              <span>
                <strong>Do not approve.</strong> Approving wrongly gives free Premium.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-400">2.</span>
              <span>
                <strong>Reject</strong> with a clear, friendly reason, e.g.{' '}
                <em>"Could not find this reference in our account. Please double-check the number, or contact support with your receipt."</em>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-400">3.</span>
              <span>
                When the student emails you, ask them for the <strong>exact phone number</strong> that sent the money and the <strong>time</strong>. That usually lets you spot it even if the reference was mistyped.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-400">4.</span>
              <span>
                If the payment was real but the reference was mistyped, ask them to cancel and resubmit the correct reference (they can do this themselves from My Bank Payments).
              </span>
            </li>
          </ul>
        </section>

        {/* Bottom padding for print */}
        <div className="h-8 print:h-2" />
      </div>
    </div>
  )
}

/* ───────────────────────────────────────────────────── */

function Step({
  n,
  title,
  body,
}: {
  n: number
  title: string
  body: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
        {n}
      </span>
      <div>
        <div className="text-sm font-bold text-slate-900 dark:text-white">
          {title}
        </div>
        <div className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {body}
        </div>
      </div>
    </li>
  )
}

function BankHelpCard({
  icon,
  bank,
  color,
  options,
  lookFor,
}: {
  icon: React.ReactNode
  bank: string
  color: 'emerald' | 'purple' | 'amber'
  options: string[]
  lookFor: string
}) {
  const colorMap = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  }

  return (
    <details className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 open:bg-white dark:open:bg-slate-900 transition-colors">
      <summary className="flex items-center gap-3 cursor-pointer list-none p-3.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colorMap[color]}`}>
          {icon}
        </span>
        <span className="font-semibold text-sm text-slate-900 dark:text-white flex-1">
          {bank}
        </span>
        <span className="text-[10px] text-slate-400 group-open:hidden">Show</span>
        <span className="text-[10px] text-slate-400 hidden group-open:inline">Hide</span>
      </summary>
      <div className="px-3.5 pb-4 space-y-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Where to look
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            {options.map((opt, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-slate-400 shrink-0">•</span>
                <span>{opt}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
          <strong>Look for:</strong> {lookFor}
        </div>
      </div>
    </details>
  )
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
      <span>{children}</span>
    </li>
  )
}

function Row({
  label,
  value,
  mono,
  ok,
}: {
  label: string
  value: string
  mono?: boolean
  ok?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={`font-semibold text-slate-900 dark:text-white ${
          mono ? 'font-mono' : ''
        } ${ok ? 'text-emerald-700 dark:text-emerald-400' : ''}`}
      >
        {value}
        {ok && <CheckCircle2 className="ml-1.5 inline h-3 w-3" />}
      </dd>
    </div>
  )
}

export default AdminManualPaymentsHelpPage