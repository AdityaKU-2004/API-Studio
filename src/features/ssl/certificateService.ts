import { CertificateInspectionResult } from '../../types';
import { ICertificateInspector } from '../../services/protocols/contracts';

/**
 * Browser-only SSL/TLS Certificate Inspector.
 * Honestly enforces browser security boundaries: JS in a browser cannot inspect remote
 * X.509 certificate chains, issuer details, fingerprints, or SAN entries directly.
 * Prepared via ICertificateInspector for native Tauri/Rust implementation in Phase 7.
 */
export class BrowserCertificateInspector implements ICertificateInspector {
  public readonly mode = 'browser' as const;

  public async inspect(rawInput: string, defaultPort = 443): Promise<CertificateInspectionResult> {
    let hostname = (rawInput || '').trim();
    let port = defaultPort;
    let protocolSupported = true;

    if (!hostname) {
      return {
        hostname: '',
        port,
        checkedAt: Date.now(),
        availableInBrowser: false,
        protocolSupported: false,
        browserNotice: 'Enter a hostname or HTTPS URL (e.g. api.github.com or https://example.com).',
        nativeCapabilitiesRequired: [
          'TLS handshake inspection (rustls / openssl)',
          'X.509 certificate chain extraction',
          'SHA-256 certificate fingerprinting',
        ],
        certificate: null,
      };
    }

    try {
      if (hostname.includes('://')) {
        const parsed = new URL(hostname);
        protocolSupported = parsed.protocol === 'https:' || parsed.protocol === 'wss:';
        hostname = parsed.hostname;
        port = parsed.port ? parseInt(parsed.port, 10) : protocolSupported ? 443 : 80;
      } else if (hostname.includes(':')) {
        const [h, p] = hostname.split(':');
        hostname = h;
        port = parseInt(p, 10) || defaultPort;
      }
    } catch {
      return {
        hostname,
        port,
        checkedAt: Date.now(),
        availableInBrowser: false,
        protocolSupported: false,
        browserNotice: `Could not parse "${rawInput}" as a valid hostname or URL.`,
        nativeCapabilitiesRequired: ['TLS handshake inspection'],
        certificate: null,
      };
    }

    const isSameOriginSecureContext =
      typeof window !== 'undefined' &&
      window.location?.hostname === hostname &&
      window.isSecureContext;

    const browserNotice = !protocolSupported
      ? `Target "${hostname}" is not configured for HTTPS/WSS. No TLS certificate is negotiated over plaintext protocols.`
      : isSameOriginSecureContext
      ? `Browser secure context is active for same-origin "${hostname}" (${window.location.protocol}), but Web APIs still prohibit JavaScript from reading the peer X.509 certificate chain, issuer, validity dates, or SHA-256 fingerprint.`
      : `Browser JavaScript cannot open raw TLS sockets or read remote peer X.509 certificates for "${hostname}:${port}". API Studio never fabricates certificate metadata or leaks queried hostnames to third-party lookup services.`;

    return {
      hostname,
      port,
      checkedAt: Date.now(),
      availableInBrowser: false,
      protocolSupported,
      isSameOriginSecureContext,
      browserNotice,
      nativeCapabilitiesRequired: [
        'Subject & Issuer Distinguished Names (CN, O, C)',
        'Certificate Validity Window (Valid From / Not After)',
        'Subject Alternative Names (SANs)',
        'SHA-256 & SHA-1 Fingerprints',
        'TLS Protocol Version & Cipher Suite Negotiation',
        'Full Intermediate & Root Trust Chain Verification',
      ],
      certificate: null,
    };
  }
}

export const certificateInspector: ICertificateInspector = new BrowserCertificateInspector();
