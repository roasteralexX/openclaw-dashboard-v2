import { useState, useEffect, useRef } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { useAgentStore } from '../../store/agentStore';
import { useI18n } from '../../hooks/useI18n';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import type { TicketPriority, TicketColumn, TicketLabel } from '../../types';
import styles from './TicketPanel.module.css';

/* ── Static constants ────────────────────────────── */

const ALL_LABELS: TicketLabel[] = ['feature', 'bug', 'improvement', 'research', 'blocked'];

const LABEL_ACTIVE_CLASS: Record<TicketLabel, string> = {
  feature:     styles.labelFeatureActive,
  bug:         styles.labelBugActive,
  improvement: styles.labelImprovementActive,
  research:    styles.labelResearchActive,
  blocked:     styles.labelBlockedActive,
};

const PRIORITY_ACTIVE_CLASS: Record<TicketPriority, string> = {
  P0: styles.priorityActiveP0,
  P1: styles.priorityActiveP1,
  P2: styles.priorityActiveP2,
  P3: styles.priorityActiveP3,
};


/* ── Props ───────────────────────────────────────── */

interface TicketPanelProps {
  ticketId: string;
  onClose: () => void;
}

/* ── Component ───────────────────────────────────── */

export default function TicketPanel({ ticketId, onClose }: TicketPanelProps) {
  const ticket       = useBoardStore((s) => s.tickets.find((t) => t.id === ticketId));
  const updateTicket = useBoardStore((s) => s.updateTicket);
  const deleteTicket = useBoardStore((s) => s.deleteTicket);
  const team         = useBoardStore((s) => s.team);
  const agents       = useAgentStore((s) => s.agents);
  const { t } = useI18n('kanban');
  const { t: tc } = useI18n('common');
  const timeAgo = useTimeAgo();

  // Translated COLUMNS (inside component so t() is in scope)
  const COLUMNS: { id: TicketColumn; title: string; icon: string }[] = [
    { id: 'backlog',     title: t('columns.backlog'),     icon: '○' },
    { id: 'todo',        title: t('columns.todo'),        icon: '◎' },
    { id: 'in_progress', title: t('columns.in_progress'), icon: '◉' },
    { id: 'review',      title: t('columns.review'),      icon: '◈' },
    { id: 'done',        title: t('columns.done'),        icon: '●' },
  ];

  const [editingTitle,   setEditingTitle]   = useState(false);
  const [titleDraft,     setTitleDraft]     = useState('');
  const [descDraft,      setDescDraft]      = useState('');
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync drafts when ticket changes
  useEffect(() => {
    if (ticket) {
      setTitleDraft(ticket.title);
      setDescDraft(ticket.description);
      setConfirmDelete(false);
      setEditingTitle(false);
    }
  }, [ticketId, ticket?.title, ticket?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close if ticket was deleted externally
  useEffect(() => {
    if (!ticket) onClose();
  }, [ticket, onClose]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [descDraft]);

  if (!ticket) return null;

  const assignee = team.find((m) => m.id === ticket.assigneeId);

  function toggleLabel(label: TicketLabel) {
    const next = ticket!.labels.includes(label)
      ? ticket!.labels.filter((l) => l !== label)
      : [...ticket!.labels, label];
    updateTicket(ticketId, { labels: next });
  }

  return (
    <>
      {/* Transparent backdrop — click to close */}
      <div className={styles.overlay} onClick={onClose} />

      <aside className={`${styles.panel} anim-slide-in-right`} role="dialog" aria-label={t('ticket.title')}>
        {/* Header */}
        <div className={styles.panelHeader}>
          <span className={styles.ticketId}>{ticket.id}</span>
          <button className={styles.closeBtn} onClick={onClose} title={tc('accessibility.closeModal')}>✕</button>
        </div>

        {/* Body */}
        <div className={styles.panelBody}>

          {/* Title — inline edit */}
          {editingTitle ? (
            <input
              autoFocus
              className={styles.titleInput}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft.trim()) updateTicket(ticketId, { title: titleDraft.trim() });
                setEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(ticket.title); }
              }}
            />
          ) : (
            <h2
              className={styles.title}
              onClick={() => { setEditingTitle(true); setTitleDraft(ticket.title); }}
              title={tc('actions.edit')}
            >
              {ticket.title}
            </h2>
          )}

          {/* Column selector */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{t('ticket.status')}</span>
            <div className={styles.colSelector}>
              {COLUMNS.map((col) => (
                <button
                  key={col.id}
                  className={`${styles.colBtn} ${ticket.column === col.id ? styles.colBtnActive : ''}`}
                  onClick={() => updateTicket(ticketId, { column: col.id })}
                >
                  {col.icon} {col.title}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{t('ticket.priority')}</span>
            <div className={styles.prioritySegment}>
              {(['P0', 'P1', 'P2', 'P3'] as TicketPriority[]).map((p) => (
                <button
                  key={p}
                  className={`${styles.priorityBtn} ${ticket.priority === p ? PRIORITY_ACTIVE_CLASS[p] : ''}`}
                  onClick={() => updateTicket(ticketId, { priority: p })}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{t('ticket.description')}</span>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={() => updateTicket(ticketId, { description: descDraft })}
              placeholder={t('ticket.descriptionPlaceholder')}
            />
          </div>

          {/* Assignee */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{t('ticket.assignee')}</span>
            <select
              className={styles.select}
              value={ticket.assigneeId ?? ''}
              onChange={(e) => updateTicket(ticketId, { assigneeId: e.target.value || undefined })}
            >
              <option value="">{t('ticket.untitled')}</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.avatar} {m.name} — {m.role}</option>
              ))}
            </select>
            {assignee && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-muted)', fontFamily: 'var(--ff-mono)' }}>
                {assignee.avatar} {assignee.name}
              </span>
            )}
          </div>

          {/* Agent assignment */}
          {agents.length > 0 && (
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>{t('ticket.agent')}</span>
              <select
                className={styles.select}
                value={ticket.agentId ?? ''}
                onChange={(e) => updateTicket(ticketId, { agentId: e.target.value || undefined })}
              >
                <option value="">—</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {a.role}</option>
                ))}
              </select>
            </div>
          )}

          {/* Labels */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{t('ticket.labels')}</span>
            <div className={styles.labelsRow}>
              {ALL_LABELS.map((label) => (
                <button
                  key={label}
                  className={`${styles.labelChip} ${ticket.labels.includes(label) ? LABEL_ACTIVE_CLASS[label] : ''}`}
                  onClick={() => toggleLabel(label)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{t('ticket.dueDate')}</span>
            <input
              type="date"
              className={styles.input}
              value={ticket.dueDate ?? ''}
              onChange={(e) => updateTicket(ticketId, { dueDate: e.target.value || undefined })}
            />
          </div>

          {/* Est. hours */}
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>{t('ticket.estimatedHours')}</span>
            <input
              type="number"
              className={styles.input}
              defaultValue={ticket.estimatedHours ?? ''}
              placeholder="0"
              min={0}
              onBlur={(e) => updateTicket(ticketId, { estimatedHours: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          {/* Timestamps */}
          <div className={styles.timestamps}>
            <span className={styles.timestamp}>{t('ticket.created')} {timeAgo(ticket.createdAt)}</span>
            <span className={styles.timestamp}>{t('ticket.updated')} {timeAgo(ticket.updatedAt)}</span>
          </div>
        </div>

        {/* Footer — delete */}
        <div className={styles.panelFooter}>
          {confirmDelete ? (
            <div className={styles.deleteConfirm}>
              <span className={styles.deleteConfirmText}>{t('ticket.deleteConfirm')}</span>
              <button
                className={styles.btnDanger}
                onClick={() => { deleteTicket(ticketId); onClose(); }}
              >
                {tc('buttons.confirm')}
              </button>
              <button className={styles.btnGhost} onClick={() => setConfirmDelete(false)}>
                {tc('buttons.cancel')}
              </button>
            </div>
          ) : (
            <button className={styles.btnDeleteTrigger} onClick={() => setConfirmDelete(true)}>
              {tc('buttons.delete')} {t('ticket.label')}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
