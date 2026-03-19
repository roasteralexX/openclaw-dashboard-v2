import { describe, it, expect, beforeEach } from 'vitest';
import { getGatewayClient } from './gatewayGuard';
import { useConnectionStore } from '../store/connectionStore';
import type { OpenClawClient } from './openclawClient';

// Minimal stand-in for OpenClawClient — only the shape matters for these tests.
function makeMockClient(): OpenClawClient {
  return {} as unknown as OpenClawClient;
}

beforeEach(() => {
  // Return the store to a known disconnected state before each case so that
  // localStorage/sessionStorage side-effects from the store initialiser cannot
  // bleed between tests.
  useConnectionStore.setState({ status: 'disconnected', client: null });
});

describe('getGatewayClient', () => {
  it('GG-001: returns null when status is disconnected', () => {
    useConnectionStore.setState({ status: 'disconnected', client: null });

    expect(getGatewayClient()).toBeNull();
  });

  it('GG-002: returns null when status is connecting', () => {
    useConnectionStore.setState({ status: 'connecting', client: null });

    expect(getGatewayClient()).toBeNull();
  });

  it('GG-003: returns null when status is suspended', () => {
    useConnectionStore.setState({ status: 'suspended', client: null });

    expect(getGatewayClient()).toBeNull();
  });

  it('GG-004: returns null when status is connected but client is null', () => {
    useConnectionStore.setState({ status: 'connected', client: null });

    expect(getGatewayClient()).toBeNull();
  });

  it('GG-005: returns { client } when status is connected and client is present', () => {
    const mockClient = makeMockClient();
    useConnectionStore.setState({ status: 'connected', client: mockClient });

    const result = getGatewayClient();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('client');
  });

  it('GG-006: the returned client is reference-equal to the client in the store', () => {
    const mockClient = makeMockClient();
    useConnectionStore.setState({ status: 'connected', client: mockClient });

    const result = getGatewayClient();

    // result is guaranteed non-null by GG-005; assert to satisfy TypeScript.
    expect(result).not.toBeNull();
    expect(result!.client).toBe(mockClient);
  });
});
