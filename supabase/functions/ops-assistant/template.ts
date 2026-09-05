import type { JobRow } from './tools/search-jobs.ts'

export function formatUnscheduledJobs(jobs: JobRow[]): string {
  if (jobs.length === 0) return 'No unscheduled jobs.'
  const names = jobs.map((j) => {
    const detail = j.work_summary?.trim()
    return detail ? `${j.customer_name} (${detail})` : j.customer_name
  })
  return `${jobs.length} unscheduled job(s): ${names.join(', ')}. Assign them on Tracking.`
}
