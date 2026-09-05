import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react'

export function DocumentStatus({
  status,
  stage,
  showStage = false,
}: {
  status: string
  stage: string
  showStage?: boolean
}) {
  const isActive = status === 'queued' || status === 'processing'
  const Icon = isActive
    ? LoaderCircle
    : status === 'completed'
      ? CheckCircle2
      : CircleAlert
  const color =
    status === 'completed'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : status === 'failed'
        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
        : status === 'needs_review'
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}
    >
      <Icon className={`size-3.5 ${isActive ? 'animate-spin' : ''}`} />
      {status.replace('_', ' ')}
      {showStage && stage !== status ? ` · ${stage}` : ''}
    </span>
  )
}
