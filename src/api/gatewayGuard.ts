import { useConnectionStore } from '../store/connectionStore';
import type { OpenClawClient } from './openclawClient';

export interface GatewayConnection {
  client: OpenClawClient;
}

/**
 * Returns the connected gateway client, or null if not connected.
 * Use this in store actions instead of repeating the guard inline:
 *   const gw = getGatewayClient();
 *   if (!gw) return;
 *   gw.client.call(...)
 */
export function getGatewayClient(): GatewayConnection | null {
  const { client, status } = useConnectionStore.getState();
  if (status !== 'connected' || !client) return null;
  return { client };
}
