import {
  ICertificateInspector,
  IFileOperationsService,
  IHttpTransport,
  ISseTransport,
  IWebSocketTransport,
} from '../protocols/contracts';
import { requestExecutor } from '../http/requestExecutor';
import { websocketClient as browserWebSocketClient } from '../protocols/websocket/websocketClient';
import { sseClient as browserSseClient } from '../protocols/sse/sseClient';
import { BrowserCertificateInspector } from '../../features/ssl/certificateService';
import { desktopHttpService } from '../desktop/httpService';
import { desktopWebSocketService } from '../desktop/websocketService';
import { desktopSseService } from '../desktop/sseService';
import { desktopCertificateInspector } from '../desktop/certificateService';
import { browserFileService, desktopFileService } from '../desktop/fileService';
import { detectRuntimeCapabilities } from './capabilities';

const browserCertInspector = new BrowserCertificateInspector();

export function getHttpTransport(overrideIsDesktop?: boolean): IHttpTransport {
  const isDesktop = overrideIsDesktop ?? detectRuntimeCapabilities().isDesktop;
  return isDesktop ? desktopHttpService : requestExecutor;
}

export function getWebSocketTransport(overrideIsDesktop?: boolean): IWebSocketTransport {
  const isDesktop = overrideIsDesktop ?? detectRuntimeCapabilities().isDesktop;
  return isDesktop ? desktopWebSocketService : browserWebSocketClient;
}

export function getSseTransport(overrideIsDesktop?: boolean): ISseTransport {
  const isDesktop = overrideIsDesktop ?? detectRuntimeCapabilities().isDesktop;
  return isDesktop ? desktopSseService : browserSseClient;
}

export function getCertificateInspector(overrideIsDesktop?: boolean): ICertificateInspector {
  const isDesktop = overrideIsDesktop ?? detectRuntimeCapabilities().isDesktop;
  return isDesktop ? desktopCertificateInspector : browserCertInspector;
}

export function getFileService(overrideIsDesktop?: boolean): IFileOperationsService {
  const isDesktop = overrideIsDesktop ?? detectRuntimeCapabilities().isDesktop;
  return isDesktop ? desktopFileService : browserFileService;
}
