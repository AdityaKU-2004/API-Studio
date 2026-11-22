import { create } from 'zustand';
import {
  ApiRequest,
  ApiResponse,
  RequestDiagnosticItem,
  RequestPreviewSummary,
} from '../types';
import {
  analyzeRequestDiagnostics,
  buildRequestPreviewSummary,
} from '../services/protocols/http/diagnosticsAnalyzer';
import { useEnvironmentStore } from './environmentStore';
import { useCollectionStore } from './collectionStore';

interface DiagnosticsState {
  diagnosticsByTabId: Record<string, RequestDiagnosticItem[]>;
  computeDiagnostics: (
    tabId: string,
    request: ApiRequest,
    response?: ApiResponse | null
  ) => RequestDiagnosticItem[];
  buildPreview: (request: ApiRequest) => RequestPreviewSummary;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  diagnosticsByTabId: {},

  computeDiagnostics: (tabId, request, response) => {
    const col = request.collectionId
      ? useCollectionStore.getState().collections.find((c) => c.id === request.collectionId)
      : undefined;
    const resolvedVars = useEnvironmentStore.getState().getResolvedVariables({
      collectionVariables: col?.variables,
      requestVariables: request.variables,
    });
    const list = analyzeRequestDiagnostics(request, resolvedVars, response);
    set((s) => ({
      diagnosticsByTabId: {
        ...s.diagnosticsByTabId,
        [tabId]: list,
      },
    }));
    return list;
  },

  buildPreview: (request) => {
    const col = request.collectionId
      ? useCollectionStore.getState().collections.find((c) => c.id === request.collectionId)
      : undefined;
    const resolvedVars = useEnvironmentStore.getState().getResolvedVariables({
      collectionVariables: col?.variables,
      requestVariables: request.variables,
    });
    return buildRequestPreviewSummary(request, resolvedVars);
  },
}));
