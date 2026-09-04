interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'indigo' | 'emerald' | 'white'
  label?: string
}

export function Spinner({ size = 'md', color = 'indigo', label }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  }

  const colorClasses = {
    indigo: 'border-indigo-200 border-t-indigo-600',
    emerald: 'border-emerald-200 border-t-emerald-600',
    white: 'border-white/30 border-t-white',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
        role="status"
        aria-label="Loading"
      />
      {label && (
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 animate-pulse">
          {label}
        </span>
      )}
    </div>
  )
}