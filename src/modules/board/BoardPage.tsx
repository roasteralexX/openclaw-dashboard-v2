import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBoardStore } from '../../store/boardStore';
import { useAgentStore } from '../../store/agentStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useI18n } from '../../hooks/useI18n';
import GatewayEmptyState from '../../components/shared/GatewayEmptyState';
import DisconnectedOverlay from '../../components/shared/DisconnectedOverlay';
import BoardIllustration from '../../components/shared/illustrations/BoardIllustration';
import TicketPanel from '../../components/board/TicketPanel';
import TicketModal from '../../components/board/TicketModal';
import type { Ticket, TicketColumn, TicketPriority, TicketLabel } from '../../types';
import styles from './board.module.css';
import uiStyles from '../../components/ui/ui.module.css';

/* ── Static constants (not i18n-dependent) ───────── */

const PRIORITY_ORDER: Record<TicketPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

const PRIORITY_BORDER: Record<TicketPriority, string> = {
  P0: 'var(--c-error)',
  P1: 'var(--c-warn-500)',
  P2: 'var(--c-accent-500)',
  P3: 'var(--c-base-300)',
};

const PRIORITY_CHIP_ACTIVE: Record<TicketPriority, string> = {
  P0: styles.filterChipP0Active,
  P1: styles.filterChipP1Active,
  P2: styles.filterChipP2Active,
  P3: styles.filterChipP3Active,
};

const LABEL_CHIP_ACTIVE: Record<TicketLabel, string> = {
  feature:     uiStyles.badgeFeature,
  bug:         uiStyles.badgeBug,
  improvement: uiStyles.badgeImprovement,
  research:    uiStyles.badgeResearch,
  blocked:     uiStyles.badgeBlocked,
};

const labelClass: Record<TicketLabel, string> = {
  feature:     uiStyles.badgeFeature,
  bug:         uiStyles.badgeBug,
  improvement: uiStyles.badgeImprovement,
  research:    uiStyles.badgeResearch,
  blocked:     uiStyles.badgeBlocked,
};

const priorityClass: Record<TicketPriority, string> = {
  P0: uiStyles.badgeP0,
  P1: uiStyles.badgeP1,
  P2: uiStyles.badgeP2,
  P3: uiStyles.badgeP3,
};

const ALL_PRIORITIES: TicketPriority[] = ['P0', 'P1', 'P2', 'P3'];
const ALL_LABELS: TicketLabel[] = ['feature', 'bug', 'improvement', 'research', 'blocked'];

/* ── Column shape ────────────────────────────────── */

type ColumnDef = { id: TicketColumn; title: string; icon: string };

/* ── Sortable Ticket Card ────────────────────────── */

function SortableTicketCard({
  ticket,
  onOpen,
  overdueLabel,
  dragToMoveLabel,
}: {
  ticket: Ticket;
  onOpen: (id: string) => void;
  overdueLabel: string;
  dragToMoveLabel: string;
}) {
  const team   = useBoardStore((s) => s.team);
  const agents = useAgentStore((s) => s.agents);
  const assignee = team.find((m) => m.id === ticket.assigneeId);
  const agentName = agents.find((a) => a.id === ticket.agentId)?.name;
  const isOverdue = ticket.dueDate ? new Date(ticket.dueDate) < new Date() : false;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id, data: { ticket } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: PRIORITY_BORDER[ticket.priority],
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`${styles.ticket} ${isDragging ? styles.ticketDragging : ''}`}
      onClick={() => onOpen(ticket.id)}
    >
      <div className={styles.ticketTop}>
        <span className={`${uiStyles.badge} ${priorityClass[ticket.priority]}`}>
          {ticket.priority}
        </span>
        <span className={styles.ticketId}>{ticket.id}</span>
        {/* Drag handle — listeners here, NOT on card root */}
        <div
          className={styles.dragHandle}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          title={dragToMoveLabel}
        >
          ⠿
        </div>
      </div>

      <div className={styles.ticketTitle}>{ticket.title}</div>

      {/* Meta badges */}
      {(agentName || isOverdue) && (
        <div className={styles.ticketMeta}>
          {agentName && <span className={styles.agentBadge}>⬡ {agentName}</span>}
          {isOverdue && <span className={styles.overdueTag}>⚠ {overdueLabel}</span>}
        </div>
      )}

      {/* Bottom row: assignee + labels + P&L */}
      <div className={styles.ticketBottom}>
        {assignee && (
          <span className={styles.assigneeChip}>
            {assignee.avatar} {assignee.name}
          </span>
        )}
        {ticket.labels.map((l) => (
          <span key={l} className={`${uiStyles.badge} ${labelClass[l]}`}>{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Drag Overlay Preview ────────────────────────── */

function TicketOverlay({ ticket }: { ticket: Ticket }) {
  const team = useBoardStore((s) => s.team);
  const assignee = team.find((m) => m.id === ticket.assigneeId);
  return (
    <div
      className={styles.ticket}
      style={{
        opacity: 0.92,
        transform: 'rotate(2deg)',
        cursor: 'grabbing',
        borderLeftColor: PRIORITY_BORDER[ticket.priority],
        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      }}
    >
      <div className={styles.ticketTop}>
        <span className={`${uiStyles.badge} ${priorityClass[ticket.priority]}`}>{ticket.priority}</span>
        <span className={styles.ticketId}>{ticket.id}</span>
      </div>
      <div className={styles.ticketTitle}>{ticket.title}</div>
      {assignee && (
        <div className={styles.ticketBottom}>
          <span className={styles.assigneeChip}>{assignee.avatar} {assignee.name}</span>
        </div>
      )}
    </div>
  );
}

/* ── Kanban Column ───────────────────────────────── */

function KanbanColumn({
  col,
  tickets,
  onOpen,
  onQuickAdd,
  dropHereLabel,
  overdueLabel,
  dragToMoveLabel,
}: {
  col: ColumnDef;
  tickets: Ticket[];
  onOpen: (id: string) => void;
  onQuickAdd: (colId: TicketColumn) => void;
  dropHereLabel: string;
  overdueLabel: string;
  dragToMoveLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const sorted = [...tickets].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  return (
    <SortableContext
      id={col.id}
      items={sorted.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={`${styles.column} ${isOver ? styles.columnDragOver : ''}`}
        id={col.id}
      >
        <div className={styles.columnHeader}>
          <span className={styles.columnIcon}>{col.icon}</span>
          <span className={styles.columnTitle}>{col.title}</span>
          <span className={styles.columnCount}>{tickets.length}</span>
          <button
            className={styles.colAddBtn}
            onClick={() => onQuickAdd(col.id)}
            title={`+ ${col.title}`}
          >
            +
          </button>
        </div>

        <div className={styles.columnCards}>
          {sorted.map((ticket) => (
            <SortableTicketCard
              key={ticket.id}
              ticket={ticket}
              onOpen={onOpen}
              overdueLabel={overdueLabel}
              dragToMoveLabel={dragToMoveLabel}
            />
          ))}
          {sorted.length === 0 && (
            <div className={styles.emptyColumn}>{dropHereLabel}</div>
          )}
        </div>
      </div>
    </SortableContext>
  );
}

/* ── Board Toolbar ───────────────────────────────── */

function BoardToolbar({ onNewTicket }: { onNewTicket: () => void }) {
  const filter          = useBoardStore((s) => s.filter);
  const setFilter       = useBoardStore((s) => s.setFilter);
  const clearFilter     = useBoardStore((s) => s.clearFilter);
  const filteredTickets = useBoardStore((s) => s.filteredTickets);
  const { t } = useI18n('kanban');

  const tickets  = filteredTickets();
  const total    = tickets.length;
  const done     = tickets.filter((t) => t.column === 'done').length;
  const donePct  = total > 0 ? Math.round((done / total) * 100) : 0;
  const p0Count  = tickets.filter((t) => t.priority === 'P0').length;

  const hasFilters =
    filter.search !== '' ||
    filter.priorities.length > 0 ||
    filter.labels.length > 0 ||
    filter.assigneeId !== null;

  function togglePriority(p: TicketPriority) {
    const next = filter.priorities.includes(p)
      ? filter.priorities.filter((x) => x !== p)
      : [...filter.priorities, p];
    setFilter({ priorities: next });
  }

  function toggleLabel(l: TicketLabel) {
    const next = filter.labels.includes(l)
      ? filter.labels.filter((x) => x !== l)
      : [...filter.labels, l];
    setFilter({ labels: next });
  }

  return (
    <div className={styles.toolbar}>
      {/* Search */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          className={styles.searchInput}
          placeholder={t('toolbar.searchPlaceholder')}
          value={filter.search}
          onChange={(e) => setFilter({ search: e.target.value })}
        />
      </div>

      {/* Priority filters */}
      <div className={styles.filterRow}>
        {ALL_PRIORITIES.map((p) => (
          <button
            key={p}
            className={`${styles.filterChip} ${filter.priorities.includes(p) ? PRIORITY_CHIP_ACTIVE[p] : ''}`}
            onClick={() => togglePriority(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className={styles.filterDivider} />

      {/* Label filters */}
      <div className={styles.filterRow}>
        {ALL_LABELS.map((l) => (
          <button
            key={l}
            className={`${styles.filterChip} ${filter.labels.includes(l) ? `${styles.filterChipActive} ${LABEL_CHIP_ACTIVE[l]}` : ''}`}
            onClick={() => toggleLabel(l)}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Clear */}
      {hasFilters && (
        <button className={styles.clearFilters} onClick={clearFilter}>
          {t('toolbar.clearFilters')}
        </button>
      )}

      {/* Stats */}
      <div className={styles.stats}>
        <span>{t('toolbar.stats.total', { count: total })}</span>
        <span className={styles.statsDivider}>·</span>
        <span>{donePct}{t('toolbar.stats.donePct')}</span>
        {p0Count > 0 && (
          <>
            <span className={styles.statsDivider}>·</span>
            <span className={styles.statsP0}>{p0Count}× P0</span>
          </>
        )}
      </div>

      {/* New ticket */}
      <button className={styles.btnPrimary} onClick={onNewTicket}>
        + {t('toolbar.newTicket')}
      </button>
    </div>
  );
}

/* ── Board Page ──────────────────────────────────── */

export default function BoardPage() {
  const moveTicket       = useBoardStore((s) => s.moveTicket);
  const selectTicket     = useBoardStore((s) => s.selectTicket);
  const selectedTicketId = useBoardStore((s) => s.selectedTicketId);
  const filteredTickets  = useBoardStore((s) => s.filteredTickets);
  const gwStatus         = useConnectionStore((s) => s.status);
  const { t } = useI18n('kanban');

  // Translated COLUMNS — defined inside component so t() works
  const COLUMNS: ColumnDef[] = [
    { id: 'backlog',     title: t('columns.backlog'),     icon: '○' },
    { id: 'todo',        title: t('columns.todo'),        icon: '◎' },
    { id: 'in_progress', title: t('columns.in_progress'), icon: '◉' },
    { id: 'review',      title: t('columns.review'),      icon: '◈' },
    { id: 'done',        title: t('columns.done'),        icon: '●' },
  ];

  const [activeTicket,       setActiveTicket]       = useState<Ticket | null>(null);
  const [modalOpen,          setModalOpen]          = useState(false);
  const [modalDefaultColumn, setModalDefaultColumn] = useState<TicketColumn>('backlog');

  const openModal = useCallback((col: TicketColumn = 'backlog') => {
    setModalDefaultColumn(col);
    setModalOpen(true);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const isInput =
        ['input', 'textarea', 'select'].includes(tag) ||
        (e.target as HTMLElement).isContentEditable;

      if (e.key === 'Escape') {
        if (selectedTicketId) { selectTicket(null); return; }
        if (modalOpen) { setModalOpen(false); return; }
      }
      if (e.key === 'n' && !isInput && !e.metaKey && !e.ctrlKey) {
        openModal();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedTicketId, modalOpen, selectTicket, openModal]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const ticket = filteredTickets().find((t) => t.id === event.active.id);
    if (ticket) setActiveTicket(ticket);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null);
    const { active, over } = event;
    if (!over) return;

    const ticketId = active.id as string;
    const targetColumn = COLUMNS.find((c) => c.id === over.id);
    if (targetColumn) { moveTicket(ticketId, targetColumn.id); return; }

    const allTickets = filteredTickets();
    const overTicket = allTickets.find((t) => t.id === over.id);
    if (overTicket) moveTicket(ticketId, overTicket.column);
  }

  const emptyState = (
    <GatewayEmptyState
      illustration={<BoardIllustration />}
      headline={t('board.headline')}
      description={t('board.description')}
      features={[
        t('board.feature0'),
        t('board.feature1'),
        t('board.feature2'),
        t('board.feature3'),
      ]}
    />
  );

  const tickets = filteredTickets();
  const overdueLabel = t('board.overdue');
  const dragToMoveLabel = t('board.dragToMove');
  const dropHereLabel = t('board.dropHere');

  return (
    <>
      <div className={styles.boardPage}>
        <BoardToolbar onNewTicket={() => openModal()} />

        <DisconnectedOverlay connected={gwStatus === 'connected'} emptyState={emptyState}>
          <div className={styles.boardScroll}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className={styles.board}>
                {COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    col={col}
                    tickets={tickets.filter((t) => t.column === col.id)}
                    onOpen={(id) => selectTicket(id)}
                    onQuickAdd={openModal}
                    dropHereLabel={dropHereLabel}
                    overdueLabel={overdueLabel}
                    dragToMoveLabel={dragToMoveLabel}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeTicket ? <TicketOverlay ticket={activeTicket} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        </DisconnectedOverlay>
      </div>

      {/* Ticket detail panel */}
      {selectedTicketId && (
        <TicketPanel
          ticketId={selectedTicketId}
          onClose={() => selectTicket(null)}
        />
      )}

      {/* Create ticket modal */}
      {modalOpen && (
        <TicketModal
          defaultColumn={modalDefaultColumn}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
