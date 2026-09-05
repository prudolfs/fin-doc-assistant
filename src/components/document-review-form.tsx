import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { EditableDocumentField } from '../../shared/documentReview'
import type { FinanceDocumentExtraction } from '../../shared/financeSchemas'
import { useMutation } from 'convex/react'
import { Check, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'

type LineItem = FinanceDocumentExtraction['lineItems'][number]

export function DocumentReviewForm({
  documentId,
  extraction,
  confirmedFields,
  pageCount,
}: {
  documentId: Id<'documents'>
  extraction: FinanceDocumentExtraction
  confirmedFields: ReadonlyArray<EditableDocumentField>
  pageCount: number
}) {
  const saveReview = useMutation(api.documents.saveReview)
  const [draft, setDraft] = useState(extraction)
  const [saving, setSaving] = useState<'draft' | 'approve' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function setField<Field extends EditableDocumentField>(
    field: Field,
    value: FinanceDocumentExtraction[Field],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }))
  }

  async function submit(approve: boolean) {
    setSaving(approve ? 'approve' : 'draft')
    setMessage(null)
    try {
      const result = await saveReview({
        documentId,
        extraction: draft,
        approve,
      })
      setMessage(
        result.status === 'completed'
          ? 'Document approved.'
          : 'Review changes saved.',
      )
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'Could not save review.',
      )
    } finally {
      setSaving(null)
    }
  }

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6 dark:bg-neutral-950">
      <div>
        <h3 className="text-lg font-semibold">Review extracted data</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Edited fields are marked user-confirmed and survive future retries.
        </p>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Document type"
          provenance={getProvenance('documentType', confirmedFields)}
          value={draft.documentType}
          onChange={(value) =>
            setField('documentType', value as 'receipt' | 'invoice')
          }
          options={['receipt', 'invoice']}
        />
        <TextField
          label="Supplier / merchant"
          provenance={getProvenance('merchantOrSupplierName', confirmedFields)}
          value={draft.merchantOrSupplierName}
          onChange={(value) => setField('merchantOrSupplierName', value)}
        />
        <TextField
          label="Document number"
          provenance={getProvenance('documentNumber', confirmedFields)}
          value={draft.documentNumber}
          onChange={(value) => setField('documentNumber', value)}
        />
        <TextField
          label="Supplier tax ID"
          provenance={getProvenance('supplierTaxIdentifier', confirmedFields)}
          value={draft.supplierTaxIdentifier}
          onChange={(value) => setField('supplierTaxIdentifier', value)}
        />
        <DateField
          label="Issue date"
          provenance={getProvenance('issueDate', confirmedFields)}
          value={draft.issueDate.iso}
          onChange={(value) =>
            setField('issueDate', { ...draft.issueDate, iso: value })
          }
        />
        <DateField
          label="Due date"
          provenance={getProvenance('dueDate', confirmedFields)}
          value={draft.dueDate.iso}
          onChange={(value) =>
            setField('dueDate', { ...draft.dueDate, iso: value })
          }
        />
        <TextField
          label="Currency"
          provenance={getProvenance('currency', confirmedFields)}
          value={draft.currency}
          maxLength={3}
          onChange={(value) =>
            setField('currency', value?.toUpperCase() ?? null)
          }
        />
        <SelectField
          label="Payment status"
          provenance={getProvenance('paymentStatus', confirmedFields)}
          value={draft.paymentStatus ?? ''}
          onChange={(value) =>
            setField(
              'paymentStatus',
              (value || null) as FinanceDocumentExtraction['paymentStatus'],
            )
          }
          options={['', 'paid', 'unpaid', 'partially_paid', 'unknown']}
        />
        <MoneyField
          label="Subtotal"
          provenance={getProvenance('subtotalMinor', confirmedFields)}
          value={draft.subtotalMinor}
          onChange={(value) => setField('subtotalMinor', value)}
        />
        <MoneyField
          label="Discount"
          provenance={getProvenance('discountMinor', confirmedFields)}
          value={draft.discountMinor}
          onChange={(value) => setField('discountMinor', value)}
        />
        <MoneyField
          label="Tax"
          provenance={getProvenance('taxMinor', confirmedFields)}
          value={draft.taxMinor}
          onChange={(value) => setField('taxMinor', value)}
        />
        <MoneyField
          label="Total"
          provenance={getProvenance('totalMinor', confirmedFields)}
          value={draft.totalMinor}
          onChange={(value) => setField('totalMinor', value)}
        />
      </div>

      <div className="mt-8 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold">Line items</h4>
            <p className="mt-1 text-xs text-neutral-500">
              Source pages must be between 1 and {pageCount}.
            </p>
          </div>
          <Provenance value={getProvenance('lineItems', confirmedFields)} />
        </div>
        <div className="mt-4 space-y-4">
          {draft.lineItems.map((item, index) => (
            <div
              key={index}
              className="rounded-2xl border bg-neutral-50 p-4 dark:bg-neutral-900"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="sm:col-span-2 lg:col-span-4">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Description
                  </span>
                  <input
                    className={inputClass}
                    value={item.description}
                    onChange={(event) =>
                      updateLineItem(index, { description: event.target.value })
                    }
                  />
                </label>
                <NumberField
                  label="Quantity"
                  value={item.quantity}
                  onChange={(value) =>
                    updateLineItem(index, { quantity: value })
                  }
                />
                <MoneyField
                  label="Unit price"
                  value={item.unitPriceMinor}
                  onChange={(value) =>
                    updateLineItem(index, { unitPriceMinor: value })
                  }
                />
                <MoneyField
                  label="Tax"
                  value={item.taxMinor}
                  onChange={(value) =>
                    updateLineItem(index, { taxMinor: value })
                  }
                />
                <MoneyField
                  label="Line total"
                  value={item.totalMinor}
                  onChange={(value) =>
                    updateLineItem(index, { totalMinor: value })
                  }
                />
                <NumberField
                  label="Source page"
                  value={item.sourcePage}
                  min={1}
                  max={pageCount}
                  integer
                  onChange={(value) =>
                    updateLineItem(index, { sourcePage: value })
                  }
                />
              </div>
              <button
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300"
                onClick={() =>
                  setField(
                    'lineItems',
                    draft.lineItems.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  )
                }
              >
                <Trash2 className="size-3.5" />
                Remove line
              </button>
            </div>
          ))}
          <button
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
            onClick={() =>
              setField('lineItems', [
                ...draft.lineItems,
                {
                  description: 'New line item',
                  quantity: 1,
                  unit: null,
                  unitPriceMinor: null,
                  discountMinor: null,
                  taxRateBasisPoints: null,
                  taxMinor: null,
                  totalMinor: null,
                  sourcePage: 1,
                },
              ])
            }
          >
            <Plus className="size-4" />
            Add line item
          </button>
        </div>
      </div>

      {message && (
        <p
          className="mt-5 rounded-xl bg-neutral-100 p-3 text-sm dark:bg-neutral-900"
          role="status"
        >
          {message}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t pt-5">
        <button
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          disabled={saving !== null}
          onClick={() => submit(false)}
        >
          <Save className="size-4" />
          {saving === 'draft' ? 'Saving…' : 'Save changes'}
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving !== null}
          onClick={() => submit(true)}
        >
          <Check className="size-4" />
          {saving === 'approve' ? 'Approving…' : 'Save and approve'}
        </button>
      </div>
    </section>
  )
}

const inputClass =
  'mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:bg-neutral-950'

function getProvenance(
  field: EditableDocumentField,
  confirmed: ReadonlyArray<EditableDocumentField>,
) {
  return confirmed.includes(field) ? 'User confirmed' : 'AI extracted'
}

function Provenance({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${value === 'User confirmed' ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}
    >
      {value}
    </span>
  )
}

function FieldLabel({
  label,
  provenance,
}: {
  label: string
  provenance?: string
}) {
  return (
    <span className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
      {label}
      {provenance && <Provenance value={provenance} />}
    </span>
  )
}

function TextField({
  label,
  value,
  onChange,
  provenance,
  maxLength,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  provenance?: string
  maxLength?: number
}) {
  return (
    <label>
      <FieldLabel label={label} provenance={provenance} />
      <input
        className={inputClass}
        value={value ?? ''}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value.trimStart() || null)}
      />
    </label>
  )
}

function DateField({
  label,
  value,
  onChange,
  provenance,
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  provenance?: string
}) {
  return (
    <label>
      <FieldLabel label={label} provenance={provenance} />
      <input
        type="date"
        className={inputClass}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  provenance,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<string>
  provenance?: string
}) {
  return (
    <label>
      <FieldLabel label={label} provenance={provenance} />
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option || 'empty'} value={option}>
            {option ? option.replace('_', ' ') : 'Not set'}
          </option>
        ))}
      </select>
    </label>
  )
}

function MoneyField({
  label,
  value,
  onChange,
  provenance,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  provenance?: string
}) {
  return (
    <label>
      <FieldLabel label={label} provenance={provenance} />
      <input
        type="number"
        step="0.01"
        className={inputClass}
        value={value === null ? '' : value / 100}
        onChange={(event) =>
          onChange(
            event.target.value === ''
              ? null
              : Math.round(Number(event.target.value) * 100),
          )
        }
      />
    </label>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  integer = false,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  max?: number
  integer?: boolean
}) {
  return (
    <label>
      <FieldLabel label={label} />
      <input
        type="number"
        step={integer ? 1 : 'any'}
        min={min}
        max={max}
        className={inputClass}
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? null : Number(event.target.value),
          )
        }
      />
    </label>
  )
}
