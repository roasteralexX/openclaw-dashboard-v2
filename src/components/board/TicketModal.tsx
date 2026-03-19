import { useState, useEffect, useCallback } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { useI18n } from '../../hooks/useI18n';
import type { Ticket, TicketColumn, TicketPriority, TicketLabel } from '../../types';
import styles from './TicketModal.module.css';

/* ── Static constants ────────────────────────────── */

const ALL_LABELS: TicketLabel[] = ['feature', 'bug', 'improvement', 'research', 'blocked'];

const LABEL_ACTIVE_CLASS: Record<TicketLabel, string> = {
  feature:     styles.labelFeatureActive,
  bug:         styles.labelBugActive,
  improvement: styles.labelImprovementActive,
  research:    styles.labelResearchActive,
  blocked:     styles.labelBlockedActive,
};

/* ── ID generation ───────────────────────────────── */

function generateTicketId(tickets: Ticket[]): string {
  const max = tickets
    .map((t) => parseInt(t.id.replace('TKT-', ''), 10))
    .filter((n) => !isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `TKT-${String(max + 1).padStart(3, '0')}`;
}

/* ── Props ───────────────────────────────────────── */

interface TicketModalProps {
  defaultColumn: TicketColumn;
  onClose: () => void;
}

/* ── Component ───────────────────────────────────── */

export default function TicketModal({ defaultColumn, onClose }: TicketModalProps) {
  const tickets    = useBoardStore((s) => s.tickets);
  const team       = useBoardStore((s) => s.team);
  const addTicket  = useBoardStore((s) => s.addTicket);
  const { t } = useI18n('kanban');
  const { t: tc } = useI18n('common');

  // Translated COLUMNS — inside component so t() is in scope
  const COLUMNS: { id: TicketColumn; label: string }[] = [
    { id: 'backlog',     label: t('columns.backlog') },
    { id: 'todo',        label: t('columns.todo') },
    { id: 'in_progress', label: t('columns.in_progress') },
    { id: 'review',      label: t('columns.review') },
    { id: 'done',        label: t('columns.done') },
  ];

  const [title,       setTitle]       = useState('');
  const [column,      setColumn]      = useState<TicketColumn>(defaultColumn);
  const [priority,    setPriority]    = useState<TicketPriority>('P2');
  const [assigneeId,  setAssigneeId]  = useState('');
  const [labels,      setLabels]      = useState<TicketLabel[]>([]);
  const [description, setDescription] = useState('');
  const [titleError,  setTitleError]  = useState(false);

  // Sync column when parent changes defaultColumn
  useEffect(() => { setColumn(defaultColumn); }, [defaultColumn]);

  const handleCreate = useCallback(() => {
    if (!title.trim()) { setTitleError(true); return; }
    const newTicket: Ticket = {
      id: generateTicketId(tickets),
      title: title.trim(),
      description,
      column,
      priority,
      assigneeId: assigneeId || undefined,
      labels,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addTicket(newTicket);
    onClose();
  }, [title, description, column, priority, assigneeId, labels, tickets, addTicket, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (e.key === 'Enter' && !e.shiftKey && tag !== 'textarea') {
        handleCreate();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, handleCreate]);

  function toggleLabel(label: TicketLabel) {
    setLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />

      <div
        className={`${styles.modal} anim-fade-in-up`}
        role="dialog"
        aria-label={t('toolbar.newTicket')}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{t('toolbar.newTicket')}</span>
          <button className={styles.closeBtn} onClick={onClose} title={tc('accessibility.closeModal')}>✕</button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>

          {/* Title — required */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              {t('ticket.title')} <span className={styles.required}>*</span>
            </label>
            <input
              autoFocus
              className={`${styles.input} ${titleError ? styles.inputError : ''}`}
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(false); }}
              placeholder={t('ticket.untitled')}
            />
            {titleError && <span className={styles.errorText}>{tc('accessibility.required')}</span>}
          </div>

          {/* Column + Priority */}
          <div className={styles.twoCol}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{t('ticket.status')}</label>
              <select
                className={styles.select}
                value={column}
                onChange={(e) => setColumn(e.target.value as TicketColumn)}
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>{t('ticket.priority')}</label>
              <select
                className={styles.select}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
              >
                {(['P0', 'P1', 'P2', 'P3'] as TicketPriority[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('ticket.assignee')}</label>
            <select
              className={styles.select}
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">—</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.avatar} {m.name} — {m.role}</option>
              ))}
            </select>
          </div>

          {/* Labels */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('ticket.labels')}</label>
            <div className={styles.labelsRow}>
              {ALL_LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className={`${styles.labelChip} ${labels.includes(label) ? LABEL_ACTIVE_CLASS[label] : ''}`}
                  onClick={() => toggleLabel(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Description — optional */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>{t('ticket.description')}</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('ticket.descriptionPlaceholder')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <span className={styles.hint}>{t('keyboard.hint')}</span>
          <div className={styles.footerActions}>
            <button className={styles.btnGhost} onClick={onClose}>{tc('buttons.cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleCreate}>{tc('actions.create')}</button>
          </div>
        </div>
      </div>
    </>
  );
}
