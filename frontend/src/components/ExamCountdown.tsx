interface ExamCountdownProps {
  examDate: string | null
}

export function ExamCountdown({ examDate }: ExamCountdownProps) {
  if (!examDate) {
    return (
      <div className="card px-4 py-3 flex items-center gap-3">
        <span className="text-sm text-ink/60">No exam date set yet — add one in your profile.</span>
      </div>
    )
  }

  const targetDate = new Date(examDate)
  targetDate.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isNaN(targetDate.getTime())) {
    return (
      <div className="card px-4 py-3 flex items-center gap-3">
        <span className="text-sm text-danger">Invalid exam date format in profile.</span>
      </div>
    )
  }

  const diffTime = targetDate.getTime() - today.getTime()
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return (
    <div className="card px-4 py-3 flex items-center gap-3">
      <div className="font-display text-2xl font-semibold text-primary tabular-nums">
        {days >= 0 ? days : 0}
      </div>
      <div className="text-sm text-ink/60 leading-tight">
        days until
        <br />
        your Exit Exam
      </div>
    </div>
  )
}