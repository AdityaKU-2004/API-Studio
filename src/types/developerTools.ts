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

export interface CertificateDetails {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber?: string;
  fingerprintSha256?: string;
  subjectAltNames?: string[];
  protocol?: string;
  cipherSuite?: string;
}

export interface CertificateInspectionResult {
  hostname: string;
  port: number;
  checkedAt: number;
  availableInBrowser: boolean;
  protocolSupported: boolean;
  isSameOriginSecureContext?: boolean;
  browserNotice: string;
  nativeCapabilitiesRequired: string[];
  certificate: CertificateDetails | null;
}
