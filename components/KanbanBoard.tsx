'use client';
import { useState, type PointerEvent } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { STAGES, Stage } from '@/lib/db/types';

interface App {
  id: string;
  company: string | null;
  title: string | null;
  stage: Stage;
  match_score: number | null;
  url: string | null;
  notes: string | null;
  date_applied: string | null;
  resume_version_id: string | null;
}

type StageTone = 'neutral' | 'active' | 'positive' | 'negative';

const STAGE_TONES: Record<Stage, StageTone> = {
  recommended: 'neutral',
  interested: 'neutral',
  saved: 'neutral',
  applied: 'active',
  response_received: 'active',
  recruiter_screen: 'active',
  first_round: 'active',
  second_round: 'active',
  final_round: 'active',
  offer: 'positive',
  offer_accepted: 'positive',
  rejected: 'negative',
  ghosted: 'negative',
};

const TONE_STYLES: Record<StageTone, { col: string; chip: string; count: string }> = {
  neutral:  { col: 'bg-ink/[0.025] border-ink/10',       chip: 'bg-ink/[0.06] text-ink/70',      count: 'text-ink/50' },
  active:   { col: 'bg-accent/[0.04] border-accent/15',  chip: 'bg-accent/10 text-accent',        count: 'text-accent/70' },
  positive: { col: 'bg-ok/[0.05] border-ok/20',          chip: 'bg-ok/10 text-ok',                count: 'text-ok/80' },
  negative: { col: 'bg-bad/[0.04] border-bad/15',        chip: 'bg-bad/10 text-bad',              count: 'text-bad/70' },
};

export function KanbanBoard({ initial }: { initial: App[] }) {
  const [apps, setApps] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const newStage = e.over?.id as Stage | undefined;
    if (!newStage) return;
    const current = apps.find((a) => a.id === id);
    if (!current || current.stage === newStage) return;
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, stage: newStage } : a)));
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    });
  }

  // Remove a card from the pipeline (e.g. showed interest but never applied).
  // Optimistic: drop it locally, then DELETE. The job's swipe row is untouched
  // server-side so the posting stays out of the deck. Re-add on failure.
  async function onDelete(id: string) {
    const prev = apps;
    setApps((cur) => cur.filter((a) => a.id !== id));
    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    if (!res.ok) setApps(prev);
  }

  const active = apps.find((a) => a.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => (
          <Column
            key={s.id}
            stage={s.id}
            label={s.label}
            apps={apps.filter((a) => a.stage === s.id)}
            onDelete={onDelete}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}>
        {active ? <Card app={active} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  label,
  apps,
  onDelete,
}: {
  stage: Stage;
  label: string;
  apps: App[];
  onDelete: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage });
  const tone = STAGE_TONES[stage];
  const styles = TONE_STYLES[tone];
  return (
    <div
      ref={setNodeRef}
      className={
        'min-w-[240px] flex-shrink-0 rounded-2xl border p-3 transition-colors duration-200 ' +
        (isOver ? 'border-accent bg-accent/[0.08] ring-1 ring-accent/30' : styles.col)
      }
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className={'rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.1em] ' + styles.chip}>
          {label}
        </h3>
        <span className={'text-xs font-medium tabular-nums ' + styles.count}>{apps.length}</span>
      </div>
      <div className="space-y-2">
        {apps.map((a) => <DraggableCard key={a.id} app={a} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

function DraggableCard({ app, onDelete }: { app: App; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={'cursor-grab touch-none' + (isDragging ? ' opacity-30' : '')}
    >
      <Card app={app} onDelete={onDelete} />
    </div>
  );
}

function Card({ app, dragging, onDelete }: { app: App; dragging?: boolean; onDelete?: (id: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const score = app.match_score != null ? Math.round(app.match_score * 100) : null;
  const scoreColor =
    score == null ? '' : score >= 75 ? 'bg-ok/10 text-ok' : score >= 55 ? 'bg-accent/10 text-accent' : 'bg-ink/[0.06] text-ink/60';
  // Buttons live inside a draggable wrapper — stop pointer events from reaching
  // the drag sensor so a click never starts a drag.
  const stop = (e: PointerEvent) => e.stopPropagation();
  return (
    <div
      className={
        'card relative p-3 text-sm transition-shadow duration-200 ' +
        (dragging ? 'shadow-card-lift rotate-[1.5deg]' : 'hover:shadow-card-lift')
      }
      style={{ transitionTimingFunction: 'var(--ease-out)' }}
    >
      {onDelete && !dragging && !confirm && (
        <button
          type="button"
          aria-label="Remove from pipeline"
          title="Remove from pipeline"
          onPointerDown={stop}
          onClick={(e) => { e.stopPropagation(); setConfirm(true); }}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-ink/30 transition-colors duration-150 hover:bg-bad/10 hover:text-bad focus-visible:bg-bad/10 focus-visible:text-bad"
        >
          <span className="text-[13px] leading-none">×</span>
        </button>
      )}
      {confirm && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-paper/90 p-2 text-center backdrop-blur-sm"
          onPointerDown={stop}
        >
          <p className="text-xs font-medium text-ink/80">Remove this card?</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirm(false); }}
              className="rounded-md bg-ink/[0.06] px-2 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete?.(app.id); }}
              className="rounded-md bg-bad/10 px-2 py-1 text-[11px] font-medium text-bad hover:bg-bad/15"
            >
              Remove
            </button>
          </div>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium leading-snug">{app.title || '(no title)'}</p>
          <p className="mt-0.5 truncate text-xs text-ink/55">{app.company || ''}</p>
        </div>
        {score != null && (
          <span className={'mr-5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ' + scoreColor}>
            {score}%
          </span>
        )}
      </div>
      {(app.url || app.resume_version_id) && (
        <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
          {app.url && (
            <a className="text-accent hover:underline" href={app.url} target="_blank" rel="noreferrer">
              posting ↗
            </a>
          )}
          {app.resume_version_id && (
            <a className="text-accent hover:underline" href="/resume-versions">
              resume ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
