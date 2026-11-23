import { UnlistenFn } from '@tauri-apps/api/event';
import { invokeDesktop, listenDesktop } from './tauriBridge';

export interface GraphqlSubscriptionEvent {
  sessionId: string;
  timestamp: number;
  raw: string;
}

export interface GraphqlSubscriptionStatus {
  sessionId: string;
  status: 'connected' | 'closed' | 'error';
  error?: string;
}

class DesktopGraphqlService {
  public async subscribe(params: {
    sessionId: string;
    endpoint: string;
    query: string;
    variables: Record<string, unknown>;
    operationName?: string;
    headers?: Record<string, string>;
    onEvent: (event: GraphqlSubscriptionEvent) => void;
    onStatus: (status: GraphqlSubscriptionStatus) => void;
  }): Promise<() => void> {
    const unlistenEv: UnlistenFn = await listenDesktop<GraphqlSubscriptionEvent>(
      'graphql://subscription-event',
      (ev) => {
        if (ev.sessionId === params.sessionId) params.onEvent(ev);
      }
    );
    const unlistenStatus: UnlistenFn = await listenDesktop<GraphqlSubscriptionStatus>(
      'graphql://subscription-status',
      (st) => {
        if (st.sessionId === params.sessionId) params.onStatus(st);
      }
    );

    await invokeDesktop('graphql_subscribe', {
      payload: {
        sessionId: params.sessionId,
        endpoint: params.endpoint,
        query: params.query,
        variables: params.variables,
        operationName: params.operationName,
        headers: params.headers || {},
        verifySsl: true,
      },
    });

    return () => {
      unlistenEv();
      unlistenStatus();
      void invokeDesktop('graphql_unsubscribe', { sessionId: params.sessionId }).catch(() => {});
    };
  }
}

export const desktopGraphqlService = new DesktopGraphqlService();
