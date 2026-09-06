import { DAY, HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { components } from './_generated/api'

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  uploadUrl: { kind: 'token bucket', rate: 20, period: HOUR, capacity: 5 },
  registerDocument: {
    kind: 'fixed window',
    rate: 20,
    period: HOUR,
    capacity: 20,
  },
  retryDocument: {
    kind: 'fixed window',
    rate: 5,
    period: HOUR,
    capacity: 5,
  },
  chatMessage: {
    kind: 'token bucket',
    rate: 12,
    period: MINUTE,
    capacity: 4,
  },
  globalChatMessage: {
    kind: 'token bucket',
    rate: 500,
    period: MINUTE,
    capacity: 100,
    shards: 10,
  },
  dataExport: { kind: 'fixed window', rate: 3, period: DAY, capacity: 3 },
})
