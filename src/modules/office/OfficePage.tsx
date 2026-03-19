import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useOfficeStore } from '../../store/officeStore';
import { useAgentStore } from '../../store/agentStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useTheme, type ThemeType } from '../../context/ThemeContext';
import GatewayEmptyState from '../../components/shared/GatewayEmptyState';
import DisconnectedOverlay from '../../components/shared/DisconnectedOverlay';
import OfficeIllustration from '../../components/shared/illustrations/OfficeIllustration';
import { useI18n } from '../../hooks/useI18n';
import type { AgentStatus, DeskPosition } from '../../types';
import styles from './office.module.css';

/* ── Status colors ───────────────────────────────── */
const statusColors: Record<AgentStatus, string> = {
  active: '#00C853',
  idle: '#FFB300',
  error: '#FF5252',
  offline: '#8899AA',
};

/* ── Camera defaults ─────────────────────────────── */
const CAM_POS: [number, number, number] = [8, 10, 12];
const CAM_TARGET: [number, number, number] = [0, 0, 0];

/* ── Theme-aware scene config ────────────────────── */
const sceneConfig = {
  dark: {
    canvasBg: '#050810',
    fogColor: '#050810',
    fogNear: 8,
    fogFar: 25,
    ambientIntensity: 0.3,
    ambientColor: '#4488aa',
    dirIntensity: 0.8,
    dirColor: '#88aacc',
    pointColor: '#00E5FF',
    pointIntensity: 0.4,
    gridCell: '#1C232D',
    gridSection: '#242C38',
    deskSurface: '#151B23',
    deskSurfaceSelected: '#1a3040',
    deskLegs: '#0F1419',
    monitor: '#0A0E14',
    chair: '#1C232D',
    accentHex: '#00E5FF',
    label: {
      bg: 'rgba(10, 14, 20, 0.88)',
      color: '#E8ECF1',
      border: 'rgba(255,255,255,0.10)',
    },
  },
  light: {
    canvasBg: '#E8EDF5',
    fogColor: '#DDE3EE',
    fogNear: 14,
    fogFar: 32,
    ambientIntensity: 1.4,
    ambientColor: '#ffffff',
    dirIntensity: 1.6,
    dirColor: '#ffffff',
    pointColor: '#007A99',
    pointIntensity: 0.2,
    gridCell: '#B8C8D8',
    gridSection: '#94A8BC',
    deskSurface: '#C8D8E8',
    deskSurfaceSelected: '#A8C4DC',
    deskLegs: '#98AABB',
    monitor: '#D0DCE8',
    chair: '#B8C8D8',
    accentHex: '#007A99',
    label: {
      bg: 'rgba(255, 255, 255, 0.92)',
      color: '#0D1117',
      border: 'rgba(0,0,0,0.12)',
    },
  },
} as const;

/* ── Drag receiving plane ────────────────────────── */
function DragPlane({
  isDraggingRef,
  dragIdRef,
  moveDesk,
}: {
  isDraggingRef: React.MutableRefObject<boolean>;
  dragIdRef: React.MutableRefObject<string | null>;
  moveDesk: (id: string, position: DeskPosition) => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      onPointerMove={(e) => {
        if (!isDraggingRef.current || !dragIdRef.current) return;
        e.stopPropagation();
        moveDesk(dragIdRef.current, {
          x: Math.round(e.point.x),
          y: 0,
          z: Math.round(e.point.z),
        });
      }}
    >
      <planeGeometry args={[80, 80]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/* ── Desk Component ──────────────────────────────── */
function Desk({
  position,
  rotation,
  agentName,
  status,
  selected,
  onClick,
  theme,
  editMode,
  onDragStart,
}: {
  position: [number, number, number];
  rotation: number;
  agentName: string;
  status: AgentStatus;
  selected: boolean;
  onClick: () => void;
  theme: ThemeType;
  editMode: boolean;
  onDragStart: () => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const color = statusColors[status];
  const cfg = sceneConfig[theme];
  const { gl } = useThree();

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.position.y = 0.01 + Math.sin(clock.getElapsedTime() * 2) * 0.002;
    }
  });

  const deskColor = selected ? cfg.deskSurfaceSelected : cfg.deskSurface;
  const editEmissiveIntensity = editMode ? (selected ? 0.18 : 0.06) : 0;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Desk surface */}
      <mesh
        position={[0, 0.5, 0]}
        onClick={(e) => {
          if (!editMode) { e.stopPropagation(); onClick(); }
        }}
        onPointerDown={(e) => {
          if (editMode) {
            e.stopPropagation();
            onClick();
            onDragStart();
            gl.domElement.style.cursor = 'grabbing';
          }
        }}
        onPointerEnter={() => {
          if (editMode) gl.domElement.style.cursor = 'grab';
        }}
        onPointerLeave={() => {
          if (editMode) gl.domElement.style.cursor = 'default';
        }}
        castShadow
      >
        <boxGeometry args={[1.8, 0.08, 0.9]} />
        <meshStandardMaterial
          color={deskColor}
          roughness={0.3}
          metalness={theme === 'dark' ? 0.6 : 0.15}
          emissive={cfg.accentHex}
          emissiveIntensity={editEmissiveIntensity}
        />
      </mesh>

      {/* Edit mode selection outline */}
      {editMode && selected && (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.92, 0.12, 1.02]} />
          <meshBasicMaterial
            color={cfg.accentHex}
            transparent
            opacity={0.25}
            wireframe
          />
        </mesh>
      )}

      {/* Desk legs */}
      {[[-0.8, 0.25, -0.35], [0.8, 0.25, -0.35], [-0.8, 0.25, 0.35], [0.8, 0.25, 0.35]].map(
        ([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
            <meshStandardMaterial color={cfg.deskLegs} roughness={0.5} metalness={theme === 'dark' ? 0.4 : 0.1} />
          </mesh>
        )
      )}

      {/* Monitor */}
      <mesh position={[0, 0.9, -0.3]} castShadow>
        <boxGeometry args={[0.8, 0.5, 0.04]} />
        <meshStandardMaterial
          color={cfg.monitor}
          roughness={0.2}
          metalness={theme === 'dark' ? 0.8 : 0.2}
          emissive={color}
          emissiveIntensity={theme === 'dark' ? 0.15 : 0.08}
        />
      </mesh>

      {/* Monitor stand */}
      <mesh position={[0, 0.65, -0.3]}>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color={cfg.deskLegs} roughness={0.5} metalness={theme === 'dark' ? 0.4 : 0.1} />
      </mesh>

      {/* Chair */}
      <mesh position={[0, 0.35, 0.6]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color={cfg.chair} roughness={0.6} metalness={theme === 'dark' ? 0.3 : 0.05} />
      </mesh>

      {/* Status glow ring */}
      <mesh ref={ringRef} position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.16, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={theme === 'dark' ? 1.5 : 0.6}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Agent name label */}
      <Html position={[0, 1.5, 0]} center distanceFactor={8}>
        <div
          style={{
            background: selected ? `rgba(${theme === 'dark' ? '10,14,20' : '255,255,255'},0.95)` : cfg.label.bg,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${selected ? color : cfg.label.border}`,
            borderRadius: 8,
            padding: '4px 12px',
            whiteSpace: 'nowrap',
            fontSize: 12,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            color: selected ? color : cfg.label.color,
            boxShadow: selected ? `0 0 15px ${color}40` : (theme === 'light' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'),
            cursor: editMode ? 'grab' : 'pointer',
            userSelect: 'none',
          }}
          onPointerDown={(e) => {
            if (editMode) e.stopPropagation();
          }}
          onClick={() => {
            if (!editMode) onClick();
          }}
        >
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 6 }} />
          {agentName}
          {editMode && <span style={{ marginLeft: 6, opacity: 0.5, fontSize: 10 }}>⠿</span>}
        </div>
      </Html>
    </group>
  );
}

/* ── Office Scene ────────────────────────────────── */
function OfficeScene({
  theme,
  editMode,
  moveDesk,
  orbitRef,
  resetCameraFnRef,
}: {
  theme: ThemeType;
  editMode: boolean;
  moveDesk: (id: string, position: DeskPosition) => void;
  orbitRef: React.MutableRefObject<{
    object: THREE.Camera;
    target: THREE.Vector3;
    update: () => void;
    enabled: boolean;
  } | null>;
  resetCameraFnRef: React.MutableRefObject<() => void>;
}) {
  const desks = useOfficeStore((s) => s.desks);
  const selectedDeskId = useOfficeStore((s) => s.selectedDeskId);
  const selectDesk = useOfficeStore((s) => s.selectDesk);
  const agents = useAgentStore((s) => s.agents);
  const cfg = sceneConfig[theme];
  const { gl } = useThree();

  const isDragging = useRef(false);
  const dragId = useRef<string | null>(null);

  // Expose reset camera to parent
  useEffect(() => {
    resetCameraFnRef.current = () => {
      const ctrl = orbitRef.current;
      if (ctrl) {
        ctrl.object.position.set(...CAM_POS);
        ctrl.target.set(...CAM_TARGET);
        ctrl.update();
      }
    };
  });

  // End drag on pointer up
  useEffect(() => {
    function handlePointerUp() {
      if (isDragging.current) {
        isDragging.current = false;
        dragId.current = null;
        if (orbitRef.current) orbitRef.current.enabled = true;
        gl.domElement.style.cursor = 'default';
      }
    }
    gl.domElement.addEventListener('pointerup', handlePointerUp);
    return () => gl.domElement.removeEventListener('pointerup', handlePointerUp);
  }, [gl, orbitRef]);

  function handleDragStart(deskId: string) {
    isDragging.current = true;
    dragId.current = deskId;
    if (orbitRef.current) orbitRef.current.enabled = false;
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={cfg.ambientIntensity} color={cfg.ambientColor} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={cfg.dirIntensity}
        color={cfg.dirColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[0, 8, 0]} intensity={cfg.pointIntensity} color={cfg.pointColor} />

      {/* Floor grid */}
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={editMode ? 0.8 : 0.5}
        cellColor={cfg.gridCell}
        sectionSize={4}
        sectionThickness={editMode ? 1.5 : 1}
        sectionColor={cfg.gridSection}
        fadeDistance={25}
        infiniteGrid
      />

      {/* Fog */}
      <fog attach="fog" args={[cfg.fogColor, cfg.fogNear, cfg.fogFar]} />

      {/* Drag plane — always rendered in edit mode */}
      {editMode && (
        <DragPlane
          isDraggingRef={isDragging}
          dragIdRef={dragId}
          moveDesk={moveDesk}
        />
      )}

      {/* Desks */}
      {desks.map((desk) => {
        const agent = agents.find((a) => a.id === desk.agentId);
        return (
          <Desk
            key={desk.id}
            position={[desk.position.x, desk.position.y, desk.position.z]}
            rotation={desk.rotation}
            agentName={agent?.name || desk.label || 'Empty'}
            status={agent?.status || 'offline'}
            selected={selectedDeskId === desk.id}
            onClick={() => selectDesk(selectedDeskId === desk.id ? null : desk.id)}
            theme={theme}
            editMode={editMode}
            onDragStart={() => handleDragStart(desk.id)}
          />
        );
      })}

      {/* Camera controls */}
      <OrbitControls
        ref={orbitRef as React.MutableRefObject<any>}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={4}
        maxDistance={18}
        target={CAM_TARGET}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

/* ── Page Component ──────────────────────────────── */
export default function OfficePage() {
  const { theme } = useTheme();
  const { t } = useI18n('office3d');
  const gwStatus = useConnectionStore((s) => s.status);
  const selectedDeskId = useOfficeStore((s) => s.selectedDeskId);
  const selectDesk = useOfficeStore((s) => s.selectDesk);
  const editMode = useOfficeStore((s) => s.editMode);
  const toggleEditMode = useOfficeStore((s) => s.toggleEditMode);
  const moveDesk = useOfficeStore((s) => s.moveDesk);
  const rotateDesk = useOfficeStore((s) => s.rotateDesk);
  const resetLayout = useOfficeStore((s) => s.resetLayout);
  const desks = useOfficeStore((s) => s.desks);
  const agents = useAgentStore((s) => s.agents);

  const orbitRef = useRef<{
    object: THREE.Camera;
    target: THREE.Vector3;
    update: () => void;
    enabled: boolean;
  } | null>(null);
  const resetCameraFnRef = useRef<() => void>(() => {});

  function handleResetView() {
    resetCameraFnRef.current();
    selectDesk(null);
  }

  function handleToggleEditMode() {
    if (editMode) selectDesk(null);
    toggleEditMode();
  }

  const selectedDesk = desks.find((d) => d.id === selectedDeskId);
  const selectedAgent = selectedDesk ? agents.find((a) => a.id === selectedDesk.agentId) : null;
  const cfg = sceneConfig[theme];

  const emptyState = (
    <GatewayEmptyState
      illustration={<OfficeIllustration />}
      headline={t('emptyState.headline')}
      description={t('emptyState.description')}
      features={[
        t('emptyState.feature0'),
        t('emptyState.feature1'),
        t('emptyState.feature2'),
        t('emptyState.feature3'),
      ]}
    />
  );

  return (
    <DisconnectedOverlay connected={gwStatus === 'connected'} emptyState={emptyState}>
    <div className={`${styles.officeWrap} ${!selectedDeskId ? styles.officeWrapNoPanel : ''}`}>
      <div className={styles.canvasWrap}>

        {/* Edit mode banner */}
        {editMode && (
          <div className={styles.editBanner}>
            <span className={styles.editBannerDot} />
            {t('editMode.banner')}
          </div>
        )}

        {/* Floating controls */}
        <div className={styles.controls}>
          <button
            className={`${styles.controlBtn} ${editMode ? styles.controlBtnActive : ''}`}
            onClick={handleToggleEditMode}
          >
            ✏️ {editMode ? t('editMode.on') : t('editMode.label')}
          </button>
          {editMode && (
            <button className={styles.controlBtn} onClick={resetLayout}>
              ↺ {t('editMode.resetLayout')}
            </button>
          )}
          <button className={styles.controlBtn} onClick={handleResetView}>
            ⟳ {t('editMode.resetView')}
          </button>
        </div>

        <Canvas
          shadows
          camera={{ position: CAM_POS, fov: 45 }}
          dpr={[1, 2]}
          style={{ background: cfg.canvasBg }}
        >
          <Suspense fallback={null}>
            <OfficeScene
              theme={theme}
              editMode={editMode}
              moveDesk={moveDesk}
              orbitRef={orbitRef}
              resetCameraFnRef={resetCameraFnRef}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Side Panel */}
      {selectedDeskId && (
        <div className={`${styles.sidePanel} anim-slide-in-right`}>
          {selectedAgent ? (
            <>
              <div className={styles.panelTitle}>{selectedAgent.name}</div>
              <div className={styles.panelRole}>{selectedAgent.role}</div>

              {/* Edit actions */}
              {editMode && (
                <div className={styles.editActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => rotateDesk(selectedDeskId)}
                  >
                    ↻ {t('editMode.rotate')}
                  </button>
                </div>
              )}

              <div className={styles.panelStat}>
                <span className={styles.panelStatLabel}>{t('panel.status')}</span>
                <span className={styles.panelStatValue}>{selectedAgent.status}</span>
              </div>
              <div className={styles.panelStat}>
                <span className={styles.panelStatLabel}>{t('agent.tokensToday')}</span>
                <span className={styles.panelStatValue}>{(selectedAgent.tokensUsedToday / 1000).toFixed(1)}K</span>
              </div>
              <div className={styles.panelStat}>
                <span className={styles.panelStatLabel}>{t('panel.tokensTotal')}</span>
                <span className={styles.panelStatValue}>{(selectedAgent.tokensUsedTotal / 1000).toFixed(0)}K</span>
              </div>
              <div className={styles.panelStat}>
                <span className={styles.panelStatLabel}>{t('panel.lastAction')}</span>
                <span className={styles.panelStatValue} style={{ fontSize: 11, maxWidth: 180, textAlign: 'right' }}>
                  {selectedAgent.lastAction}
                </span>
              </div>
              <div className={styles.panelStat}>
                <span className={styles.panelStatLabel}>{t('panel.position')}</span>
                <span className={styles.panelStatValue}>
                  ({selectedDesk?.position.x}, {selectedDesk?.position.z})
                </span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.panelTitle}>{selectedDesk?.label || t('panel.emptyDesk')}</div>
              <div className={styles.panelRole}>{t('panel.noAgent')}</div>
              {editMode && (
                <div className={styles.editActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => rotateDesk(selectedDeskId)}
                  >
                    ↻ {t('editMode.rotate')}
                  </button>
                </div>
              )}
              <div className={styles.panelStat}>
                <span className={styles.panelStatLabel}>{t('panel.position')}</span>
                <span className={styles.panelStatValue}>
                  ({selectedDesk?.position.x}, {selectedDesk?.position.z})
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
    </DisconnectedOverlay>
  );
}
