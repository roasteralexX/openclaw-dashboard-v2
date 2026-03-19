import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks must be declared before any imports that depend on the mocked modules.
vi.mock('../api/gatewayGuard', () => ({
  getGatewayClient: vi.fn(),
}));

vi.mock('./auditStore', () => ({
  useAuditStore: { getState: () => ({ log: vi.fn() }) },
}));

import { getGatewayClient } from '../api/gatewayGuard';
import { useCronStore } from './cronStore';

// Typed helper so TypeScript understands the mock
const mockGetGatewayClient = getGatewayClient as ReturnType<typeof vi.fn>;

// ── helpers ───────────────────────────────────────────────────────────────────

function makeConnectedGateway(callImpl?: ReturnType<typeof vi.fn>) {
  const mockClient = {
    call: callImpl ?? vi.fn().mockResolvedValue({ crons: [] }),
  };
  mockGetGatewayClient.mockReturnValue({ client: mockClient });
  return mockClient;
}

function makeDisconnectedGateway() {
  mockGetGatewayClient.mockReturnValue(null);
}

// ── test suite ────────────────────────────────────────────────────────────────

describe('useCronStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCronStore.setState({ crons: [], loading: false, selectedCronId: null });
  });

  // ── fetchCrons ──────────────────────────────────────────────────────────────

  describe('fetchCrons', () => {
    it('keeps crons empty when gateway is disconnected', async () => {
      makeDisconnectedGateway();

      await useCronStore.getState().fetchCrons();

      expect(useCronStore.getState().crons).toHaveLength(0);
    });

    it('calls the cron.list RPC when gateway is connected', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().fetchCrons();

      expect(mockClient.call).toHaveBeenCalledWith('cron.list');
    });

    it('leaves crons empty when the RPC throws', async () => {
      const mockClient = makeConnectedGateway(
        vi.fn().mockRejectedValue(new Error('network error'))
      );

      await useCronStore.getState().fetchCrons();

      expect(mockClient.call).toHaveBeenCalledWith('cron.list');
      const { crons, loading } = useCronStore.getState();
      expect(crons).toHaveLength(0);
      expect(loading).toBe(false);
    });

    it('sets loading to false after a successful RPC call', async () => {
      makeConnectedGateway();

      await useCronStore.getState().fetchCrons();

      expect(useCronStore.getState().loading).toBe(false);
    });

    it('populates crons from gateway response when items are returned', async () => {
      const gatewayItem = { id: 'gw-cron-1', label: 'GW Cron', expression: '0 * * * *', enabled: true };
      makeConnectedGateway(
        vi.fn().mockResolvedValue({ crons: [gatewayItem] })
      );

      await useCronStore.getState().fetchCrons();

      const { crons } = useCronStore.getState();
      expect(crons).toHaveLength(1);
      expect(crons[0].id).toBe('gw-cron-1');
      expect(crons[0].name).toBe('GW Cron');
    });

    it('keeps crons empty when gateway returns an empty crons array', async () => {
      makeConnectedGateway(vi.fn().mockResolvedValue({ crons: [] }));

      await useCronStore.getState().fetchCrons();

      expect(useCronStore.getState().crons).toHaveLength(0);
    });
  });

  // ── toggleCron ─────────────────────────────────────────────────────────────

  describe('toggleCron', () => {
    it('makes no RPC call when the cron ID contains invalid characters', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().toggleCron('bad id!', true);

      expect(mockClient.call).not.toHaveBeenCalled();
    });

    it('makes no RPC call when gateway is disconnected, even with a valid ID', async () => {
      makeDisconnectedGateway();

      // Should silently return — no throw, no RPC
      await expect(
        useCronStore.getState().toggleCron('valid-id', true)
      ).resolves.toBeUndefined();
    });

    it('calls cron.enable when enabling a cron with a valid ID', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().toggleCron('valid-id', true);

      expect(mockClient.call).toHaveBeenCalledWith('cron.enable', { id: 'valid-id' });
    });

    it('calls cron.disable when disabling a cron with a valid ID', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().toggleCron('valid-id', false);

      expect(mockClient.call).toHaveBeenCalledWith('cron.disable', { id: 'valid-id' });
    });

    it('rejects IDs with spaces', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().toggleCron('bad id', true);

      expect(mockClient.call).not.toHaveBeenCalled();
    });

    it('accepts IDs with hyphens and underscores', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().toggleCron('cron_job-1', true);

      expect(mockClient.call).toHaveBeenCalledWith('cron.enable', { id: 'cron_job-1' });
    });

    it('performs an optimistic state update after a successful enable', async () => {
      // Seed the store with a known disabled cron
      useCronStore.setState({
        crons: [
          {
            id: 'cron-x',
            name: 'Test',
            schedule: '* * * * *',
            agentId: 'agent-1',
            description: '',
            enabled: false,
            lastRun: '',
            nextRun: '',
            executions: [],
          },
        ],
      });
      makeConnectedGateway();

      await useCronStore.getState().toggleCron('cron-x', true);

      const updated = useCronStore.getState().crons.find((c) => c.id === 'cron-x');
      expect(updated?.enabled).toBe(true);
    });
  });

  // ── runCron ────────────────────────────────────────────────────────────────

  describe('runCron', () => {
    it('makes no RPC call when the cron ID contains invalid characters', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().runCron('bad id!');

      expect(mockClient.call).not.toHaveBeenCalled();
    });

    it('makes no RPC call when gateway is disconnected', async () => {
      makeDisconnectedGateway();

      await expect(
        useCronStore.getState().runCron('valid-id')
      ).resolves.toBeUndefined();
    });

    it('calls cron.run with the valid ID when connected', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().runCron('valid-id');

      expect(mockClient.call).toHaveBeenCalledWith('cron.run', { id: 'valid-id' });
    });

    it('rejects an empty string as an invalid ID', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().runCron('');

      expect(mockClient.call).not.toHaveBeenCalled();
    });

    it('accepts alphanumeric IDs with hyphens', async () => {
      const mockClient = makeConnectedGateway();

      await useCronStore.getState().runCron('cron-42');

      expect(mockClient.call).toHaveBeenCalledWith('cron.run', { id: 'cron-42' });
    });
  });

  // ── selectCron ─────────────────────────────────────────────────────────────

  describe('selectCron', () => {
    it('updates selectedCronId to the given id', () => {
      useCronStore.getState().selectCron('cron-1');
      expect(useCronStore.getState().selectedCronId).toBe('cron-1');
    });

    it('clears selectedCronId when null is passed', () => {
      useCronStore.setState({ selectedCronId: 'cron-1' });
      useCronStore.getState().selectCron(null);
      expect(useCronStore.getState().selectedCronId).toBeNull();
    });
  });
});
