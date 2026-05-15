'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronRight, ArrowLeft } from 'lucide-react';
import { FIELDS, FIELD_ORDER, OP_LABELS, opsForField, opNeedsValue } from '@/lib/fields';
import type { AnyOp, Condition, FieldId, FilterValue } from '@/lib/filter-types';
import type { VideoSummary } from '@/lib/types';
import { NumberInput } from '@/components/ui/NumberInput';
import { cn } from '@/lib/utils';

type Stage = 'property' | 'operator' | 'value';

export function FilterPopover({
  initial,
  videos,
  onCommit,
  onCancel,
}: {
  initial?: Condition;
  videos: VideoSummary[];
  onCommit: (patch: Partial<Condition> & { field: FieldId; op: AnyOp; value: FilterValue }) => void;
  onCancel?: () => void;
}) {
  const [field, setField] = useState<FieldId | null>(initial?.field ?? null);
  const [op, setOp] = useState<AnyOp | null>(initial?.op ?? null);
  const [value, setValue] = useState<FilterValue>(initial?.value ?? null);
  const [stage, setStage] = useState<Stage>(initial ? 'value' : 'property');

  const meta = field ? FIELDS[field] : null;

  function pickField(id: FieldId) {
    setField(id);
    const defaultOp = opsForField(id)[0];
    setOp(defaultOp);
    setValue(FIELDS[id].type === 'multi_select' || defaultOp === 'is_any_of' || defaultOp === 'is_none_of' ? [] : null);
    setStage(opNeedsValue(defaultOp) ? 'value' : 'operator');
    if (!opNeedsValue(defaultOp)) {
      onCommit({ field: id, op: defaultOp, value: null });
    }
  }

  function pickOp(nextOp: AnyOp) {
    setOp(nextOp);
    if (!opNeedsValue(nextOp)) {
      if (field) onCommit({ field, op: nextOp, value: null });
      return;
    }
    if (nextOp === 'is_any_of' || nextOp === 'is_none_of' || nextOp === 'contains_any_of' || nextOp === 'contains_all_of' || nextOp === 'contains_none_of') {
      setValue([]);
    }
    setStage('value');
  }

  function commitValue(v: FilterValue) {
    setValue(v);
    if (field && op) onCommit({ field, op, value: v });
  }

  if (stage === 'property' || !field) {
    return <PropertyList onPick={pickField} onCancel={onCancel} />;
  }

  return (
    <div className="min-w-[280px] max-w-[360px]">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--color-border-subtle)] text-xs text-[var(--color-fg-muted)]">
        <button
          onClick={() => setStage('property')}
          className="p-0.5 hover:text-[var(--color-fg)]"
          aria-label="Back"
        >
          <ArrowLeft className="w-3 h-3" />
        </button>
        <span className="font-medium text-[var(--color-fg)]">{meta?.label}</span>
        <span>·</span>
        <button
          onClick={() => setStage('operator')}
          className="hover:text-[var(--color-fg)]"
        >
          {op ? OP_LABELS[op] : 'is'}
        </button>
      </div>

      {stage === 'operator' && field && (
        <OperatorList field={field} current={op} onPick={pickOp} />
      )}

      {stage === 'value' && field && op && (
        <ValueInput
          field={field}
          op={op}
          value={value}
          videos={videos}
          onChange={commitValue}
        />
      )}
    </div>
  );
}

function PropertyList({
  onPick,
  onCancel,
}: {
  onPick: (id: FieldId) => void;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState('');
  const items = useMemo(() => {
    const q = query.toLowerCase();
    return FIELD_ORDER.filter((id) => FIELDS[id].label.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="min-w-[240px]">
      <div className="p-2 border-b border-[var(--color-border-subtle)]">
        <input
          autoFocus
          type="text"
          placeholder="Filter by property..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel?.(); }}
          className="w-full bg-transparent outline-none text-sm placeholder:text-[var(--color-fg-muted)]"
        />
      </div>
      <div className="max-h-[320px] overflow-y-auto p-1">
        {items.map((id) => (
          <button
            key={id}
            onClick={() => onPick(id)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-[var(--color-surface-hover)]"
          >
            <span>{FIELDS[id].label}</span>
            <ChevronRight className="w-3 h-3 opacity-40" />
          </button>
        ))}
        {items.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-[var(--color-fg-muted)]">No matches</div>
        )}
      </div>
    </div>
  );
}

function OperatorList({
  field,
  current,
  onPick,
}: {
  field: FieldId;
  current: AnyOp | null;
  onPick: (op: AnyOp) => void;
}) {
  const ops = opsForField(field);
  return (
    <div className="p-1 max-h-[320px] overflow-y-auto">
      {ops.map((op) => (
        <button
          key={op}
          onClick={() => onPick(op)}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-[var(--color-surface-hover)]"
        >
          <span>{OP_LABELS[op]}</span>
          {current === op && <Check className="w-3 h-3 text-[var(--fg)]" />}
        </button>
      ))}
    </div>
  );
}

function ValueInput({
  field,
  op,
  value,
  videos,
  onChange,
}: {
  field: FieldId;
  op: AnyOp;
  value: FilterValue;
  videos: VideoSummary[];
  onChange: (v: FilterValue) => void;
}) {
  const meta = FIELDS[field];
  const multi =
    op === 'is_any_of' ||
    op === 'is_none_of' ||
    op === 'contains_any_of' ||
    op === 'contains_all_of' ||
    op === 'contains_none_of' ||
    meta.type === 'multi_select';

  if (meta.type === 'select' || meta.type === 'multi_select') {
    const options = meta.options?.(videos) ?? [];
    return <MultiSelect
      options={options}
      multi={multi}
      value={value}
      onChange={onChange}
      labelFor={meta.optionLabel}
    />;
  }

  if (meta.type === 'text') {
    return (
      <div className="p-2">
        <input
          autoFocus
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Value..."
          className="w-full h-8 px-2 rounded bg-[var(--color-surface)] border text-sm outline-none"
        />
      </div>
    );
  }

  if (meta.type === 'number') {
    if (op === 'between') {
      const [lo, hi] = Array.isArray(value) ? value as [number, number] : [0, 0];
      return (
        <div className="p-2 flex items-center gap-2">
          <NumberInput
            value={lo}
            onChange={(n) => onChange([n ?? 0, hi] as [number, number])}
            width="w-full"
            className="flex-1"
            ariaLabel="Lower bound"
          />
          <span className="text-xs text-[var(--color-fg-muted)]">to</span>
          <NumberInput
            value={hi}
            onChange={(n) => onChange([lo, n ?? 0] as [number, number])}
            width="w-full"
            className="flex-1"
            ariaLabel="Upper bound"
          />
        </div>
      );
    }
    return (
      <div className="p-2">
        <NumberInput
          value={typeof value === 'number' ? value : null}
          onChange={(n) => onChange(n)}
          width="w-full"
          className="w-full"
          ariaLabel="Value"
        />
      </div>
    );
  }

  if (meta.type === 'date') {
    if (op === 'is_within') {
      const options: Array<[string, string]> = [
        ['today', 'Today'],
        ['yesterday', 'Yesterday'],
        ['this_week', 'This week'],
        ['past_week', 'Past week'],
        ['past_month', 'Past month'],
        ['next_week', 'Next week'],
        ['next_month', 'Next month'],
      ];
      return (
        <div className="p-1 max-h-[260px] overflow-y-auto">
          {options.map(([k, label]) => (
            <button
              key={k}
              onClick={() => onChange(k)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-[var(--color-surface-hover)]',
                value === k && 'text-[var(--fg)]'
              )}
            >
              <span>{label}</span>
              {value === k && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="p-2">
        <input
          autoFocus
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full h-8 px-2 rounded bg-[var(--color-surface)] border text-sm outline-none"
        />
      </div>
    );
  }

  return null;
}

function MultiSelect({
  options,
  multi,
  value,
  onChange,
  labelFor,
}: {
  options: string[];
  multi: boolean;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  labelFor?: (v: string) => string;
}) {
  const [query, setQuery] = useState('');
  const selected = Array.isArray(value) ? (value as string[]) : value ? [value as string] : [];
  const filtered = options.filter((o) => (labelFor?.(o) ?? o).toLowerCase().includes(query.toLowerCase()));

  function toggle(opt: string) {
    if (!multi) {
      onChange(opt);
      return;
    }
    const next = selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt];
    onChange(next);
  }

  return (
    <div className="min-w-[240px]">
      <div className="p-2 border-b border-[var(--color-border-subtle)]">
        <input
          autoFocus
          type="text"
          placeholder="Search options..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent outline-none text-sm placeholder:text-[var(--color-fg-muted)]"
        />
      </div>
      <div className="max-h-[280px] overflow-y-auto p-1">
        {filtered.map((opt) => {
          const isSel = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-[var(--color-surface-hover)]',
                isSel && 'bg-[var(--color-surface-hover)]'
              )}
            >
              <span>{labelFor?.(opt) ?? opt}</span>
              {isSel && <Check className="w-3 h-3 text-[var(--fg)]" />}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-[var(--color-fg-muted)]">No options</div>
        )}
      </div>
    </div>
  );
}
