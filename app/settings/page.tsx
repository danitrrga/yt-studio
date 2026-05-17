'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Loader2, Check, AlertCircle } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { NumberInput } from '@/components/ui/NumberInput';
import type {
  TabWidth,
  BodyFontSize,
  DefaultViewMode,
  DefaultDensity,
  DefaultLanding,
  NowWorkingRule,
  DateFormat,
} from '@/lib/settings';
import { cn } from '@/lib/utils';

interface VaultInfo {
  rootPath: string;
  exists: boolean;
  hasStructure: boolean;
}
const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TAB_OPTIONS: { value: TabWidth; label: string }[] = [
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
];

const FONT_SIZES: { value: BodyFontSize; label: string }[] = [
  { value: 13, label: '13px' },
  { value: 14, label: '14px' },
  { value: 15, label: '15px' },
];

const VIEW_MODES: { value: DefaultViewMode; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'kanban', label: 'Kanban' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'timeline', label: 'Timeline' },
];

const DENSITIES: { value: DefaultDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'regular', label: 'Regular' },
  { value: 'comfortable', label: 'Comfortable' },
];

const LANDINGS: { value: DefaultLanding; label: string }[] = [
  { value: '/', label: "Today's Focus" },
  { value: '/videos', label: 'Videos pipeline' },
  { value: '/hub', label: 'Hub' },
];

const NOW_WORKING_RULES: { value: NowWorkingRule; label: string; hint: string }[] = [
  { value: 'soonest_target', label: 'Soonest plan date', hint: 'Whatever publishes next' },
  { value: 'soonest_record', label: 'Soonest record date', hint: 'Whatever you film next' },
  { value: 'latest_edited', label: 'Most recently edited', hint: 'Whatever you opened last' },
];

const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'relative', label: 'Relative' },
  { value: 'absolute', label: 'Absolute' },
  { value: 'both', label: 'Both' },
];

export default function SettingsPage() {
  const { settings, update } = useSettings();

  return (
    <div className="px-8 py-6 space-y-6 max-w-[760px] mx-auto">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.012em] leading-[1.2] inline-flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[var(--fg-muted)]" />
          Settings
        </h1>
        <p className="text-[13px] text-[var(--fg-dim)] mt-1">
          editor preferences and app-level toggles
        </p>
      </div>

      <VaultSection />

      <Section label="Editor">
        <SettingRow label="Tab width" hint="Spaces inserted when you press Tab in the script editor.">
          <Segmented options={TAB_OPTIONS} value={settings.tabWidth} onChange={(v) => update({ tabWidth: v })} />
        </SettingRow>
        <SettingRow label="Body font size" hint="Text size inside the script editor.">
          <Segmented options={FONT_SIZES} value={settings.bodyFontSize} onChange={(v) => update({ bodyFontSize: v })} />
        </SettingRow>
        <SettingRow label="Words per minute" hint="Used to estimate spoken duration of a script.">
          <NumberInput
            value={settings.wordsPerMinute}
            onChange={(n) => {
              if (typeof n === 'number') update({ wordsPerMinute: n });
            }}
            min={60}
            max={240}
            step={5}
            ariaLabel="Words per minute"
          />
        </SettingRow>
      </Section>

      <Section label="Pipeline">
        <SettingRow label="Default view" hint="Which view mode opens by default on /videos.">
          <Select options={VIEW_MODES} value={settings.defaultViewMode} onChange={(v) => update({ defaultViewMode: v })} />
        </SettingRow>
        <SettingRow label="Default density" hint="Row height across views.">
          <Select options={DENSITIES} value={settings.defaultDensity} onChange={(v) => update({ defaultDensity: v })} />
        </SettingRow>
        <SettingRow label="Default landing page" hint="Where the app opens when you go to /.">
          <Select options={LANDINGS} value={settings.defaultLanding} onChange={(v) => update({ defaultLanding: v })} />
        </SettingRow>
      </Section>

      <Section label="Today's Focus">
        <SettingRow label='"Now working on" pick rule' hint="How the app picks which video to feature.">
          <div className="flex flex-col gap-1.5 items-end">
            {NOW_WORKING_RULES.map((o) => (
              <label
                key={o.value}
                className={cn(
                  'inline-flex items-center gap-2 cursor-pointer text-[13px]',
                  settings.nowWorkingRule === o.value
                    ? 'text-[var(--fg)]'
                    : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                )}
              >
                <input
                  type="radio"
                  name="nowWorkingRule"
                  checked={settings.nowWorkingRule === o.value}
                  onChange={() => update({ nowWorkingRule: o.value })}
                  className="accent-[var(--fg)]"
                />
                <span>{o.label}</span>
                <span className="text-[11px] text-[var(--fg-dim)]">— {o.hint}</span>
              </label>
            ))}
          </div>
        </SettingRow>
      </Section>

      <Section label="Display">
        <SettingRow label="Date format" hint='"Relative" = "in 3d", "Absolute" = "Apr 30", "Both" = both.'>
          <Segmented options={DATE_FORMATS} value={settings.dateFormat} onChange={(v) => update({ dateFormat: v })} />
        </SettingRow>
      </Section>

      <p className="text-[11px] text-[var(--fg-dim)]">
        settings persist locally in this browser only. no server sync.
      </p>
    </div>
  );
}

function VaultSection() {
  const { data, mutate, isLoading } = useSWR<VaultInfo>('/api/config/yt-path', fetcher);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data.rootPath);
  }, [data]);

  const dirty = data ? draft !== data.rootPath : false;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/config/yt-path', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: draft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? 'Save failed');
      }
      await mutate();
      toast.success('Path updated. Reloading…', {
        action: { label: 'Reload now', onClick: () => window.location.reload() },
      });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section label="Storage">
      <SettingRow
        label="Content path"
        hint="Absolute path where YT Studio stores everything: videos/, hub/, .trash/, templates/, .diagnostics/. Created on save if missing."
      >
        <div className="flex flex-col items-end gap-1.5 min-w-[320px]">
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
              disabled={saving || isLoading}
              spellCheck={false}
              className="flex-1 h-8 px-2.5 rounded-md border bg-[var(--bg-raised)] text-[12px] font-mono outline-none disabled:opacity-50"
              placeholder="/vault"
            />
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-[var(--fg)] text-[var(--fg-inverse)] text-[12px] font-medium hover:bg-[var(--fg)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save
            </button>
          </div>
          {data && !dirty && (
            <div className="flex items-center gap-1 text-[11px] text-[var(--fg-dim)]">
              {data.exists && data.hasStructure ? (
                <>
                  <Check className="w-3 h-3 text-[var(--status-published-color)]" />
                  Path exists, structure detected
                </>
              ) : data.exists ? (
                <>
                  <AlertCircle className="w-3 h-3 text-[var(--status-warn-color)]" />
                  Path exists; missing subdirs will be created on save
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-[var(--status-warn-color)]" />
                  Path does not exist yet — will be created on save
                </>
              )}
            </div>
          )}
        </div>
      </SettingRow>
    </Section>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-[var(--bg-raised)] divide-y divide-[var(--line-faint)]">
      <header className="px-4 h-10 flex items-center font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--fg-dim)]">
        {label}
      </header>
      {children}
    </section>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-4 flex items-start justify-between gap-6">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[var(--fg)]">{label}</div>
        {hint && <div className="text-[12px] text-[var(--fg-dim)] mt-1 leading-snug">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border overflow-hidden text-xs">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 h-8 transition-colors tabular-nums',
            value === o.value
              ? 'bg-[var(--fg)] text-[var(--fg-inverse)]'
              : 'bg-[var(--bg-raised)] text-[var(--fg-muted)] hover:bg-[var(--bg-hover)]'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Select<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-8 px-2 rounded-md border bg-[var(--bg-raised)] text-[13px] outline-none min-w-[160px]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
