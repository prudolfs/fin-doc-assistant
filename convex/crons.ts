import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval(
  'evaluate operational failure alerts',
  { minutes: 15 },
  internal.observability.evaluateFailureAlerts,
  {},
)
crons.interval(
  'delete expired account exports',
  { hours: 1 },
  internal.retention.deleteExpiredExports,
  {},
)
crons.interval(
  'apply account retention policies',
  { hours: 24 },
  internal.retention.sweepRetention,
  {},
)

export default crons
