import { CertificateChainNode, CertificateInspectionResult } from '../../types';
import { ICertificateInspector } from '../protocols/contracts';
import { invokeDesktop, normalizeDesktopError } from './tauriBridge';

interface NativeCertificateInspectionResponse {
  hostname: string;
  port: number;
  checkedAt: number;
  protocolSupported: boolean;
  notice: string;
  certificate: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    serialNumber: string;
    signatureAlgorithm: string;
    publicKeyAlgorithm: string;
    publicKeyBits?: number;
    fingerprintSha256: string;
    subjectAltNames: string[];
    protocol: string;
    cipherSuite: string;
    isExpired: boolean;
    notYetValid: boolean;
    daysRemaining: number;
    hostnameMatch: boolean;
    trustVerified: boolean;
    verificationError?: string;
    chain: CertificateChainNode[];
  } | null;
}

export class DesktopCertificateInspector implements ICertificateInspector {
  public readonly mode = 'native-tauri' as const;

  public async inspect(rawInput: string, defaultPort = 443): Promise<CertificateInspectionResult> {
    try {
      const res = await invokeDesktop<NativeCertificateInspectionResponse>('inspect_certificate', {
        target: rawInput,
        port: defaultPort,
      });

      return {
        hostname: res.hostname,
        port: res.port,
        checkedAt: res.checkedAt,
        availableInBrowser: false,
        mode: 'native-tauri',
        protocolSupported: res.protocolSupported,
        browserNotice: res.notice,
        nativeCapabilitiesRequired: [],
        certificate: res.certificate
          ? {
              subject: res.certificate.subject,
              issuer: res.certificate.issuer,
              validFrom: res.certificate.validFrom,
              validTo: res.certificate.validTo,
              serialNumber: res.certificate.serialNumber,
              signatureAlgorithm: res.certificate.signatureAlgorithm,
              publicKeyAlgorithm: res.certificate.publicKeyAlgorithm,
              publicKeyBits: res.certificate.publicKeyBits,
              fingerprintSha256: res.certificate.fingerprintSha256,
              subjectAltNames: res.certificate.subjectAltNames,
              protocol: res.certificate.protocol,
              cipherSuite: res.certificate.cipherSuite,
              isExpired: res.certificate.isExpired,
              notYetValid: res.certificate.notYetValid,
              daysRemaining: res.certificate.daysRemaining,
              hostnameMatch: res.certificate.hostnameMatch,
              trustVerified: res.certificate.trustVerified,
              verificationError: res.certificate.verificationError,
              chain: res.certificate.chain,
            }
          : null,
      };
    } catch (err) {
      const dErr = normalizeDesktopError(err);
      return {
        hostname: rawInput,
        port: defaultPort,
        checkedAt: Date.now(),
        availableInBrowser: false,
        mode: 'native-tauri',
        protocolSupported: false,
        browserNotice: `${dErr.message}${dErr.details ? ` (${dErr.details})` : ''}`,
        nativeCapabilitiesRequired: [],
        certificate: null,
      };
    }
  }
}

export const desktopCertificateInspector = new DesktopCertificateInspector();
