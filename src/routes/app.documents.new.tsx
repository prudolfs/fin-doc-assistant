import { createFileRoute } from '@tanstack/react-router'
import { PhaseZeroDocumentSpike } from './app.index'

export const Route = createFileRoute('/app/documents/new')({
  component: PhaseZeroDocumentSpike,
})
