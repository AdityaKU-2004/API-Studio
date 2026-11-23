export type DeveloperToolId =
  | 'json-formatter'
  | 'json-to-ts'
  | 'jwt-decoder'
  | 'base64'
  | 'url-codec'
  | 'hash-generator'
  | 'uuid-generator'
  | 'timestamp'
  | 'curl'
  | 'color-converter'
  | 'regex-tester'
  | 'ssl-inspector';

export interface DeveloperToolPreferences {
  id: string;
  lastActiveTool: DeveloperToolId;
  jsonIndentSpaces: number;
  tsRootInterfaceName: string;
  uuidDefaultCount: number;
  favoriteTools: DeveloperToolId[];
  updatedAt: number;
}

export interface CertificateChainNode {
  level: number;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  signatureAlgorithm: string;
  fingerprintSha256: string;
  isCa: boolean;
  isExpired: boolean;
}

export interface CertificateDetails {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber?: string;
  signatureAlgorithm?: string;
  publicKeyAlgorithm?: string;
  publicKeyBits?: number;
  fingerprintSha256?: string;
  subjectAltNames?: string[];
  protocol?: string;
  cipherSuite?: string;
  isExpired?: boolean;
  notYetValid?: boolean;
  daysRemaining?: number;
  hostnameMatch?: boolean;
  trustVerified?: boolean;
  verificationError?: string;
  chain?: CertificateChainNode[];
}

export interface CertificateInspectionResult {
  hostname: string;
  port: number;
  checkedAt: number;
  availableInBrowser: boolean;
  mode?: 'browser' | 'native-tauri';
  protocolSupported: boolean;
  isSameOriginSecureContext?: boolean;
  browserNotice: string;
  nativeCapabilitiesRequired: string[];
  certificate: CertificateDetails | null;
}
