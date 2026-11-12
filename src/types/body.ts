export type BodyType =
  | 'none'
  | 'json'
  | 'text'
  | 'xml'
  | 'html'
  | 'form-data'
  | 'x-www-form-urlencoded'
  | 'binary';

export interface FormDataItem {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'file';
  file?: File | {
    name: string;
    size: number;
    type: string;
  };
  description?: string;
  enabled: boolean;
}

export interface BinaryBody {
  file?: File | {
    name: string;
    size: number;
    type: string;
  };
  fileName?: string;
  filename?: string;
  fileSize?: number;
  fileType?: string;
}

export interface RequestBody {
  mode: BodyType;
  rawContent: Record<string, string>; // Preserves json, text, xml, html when switching modes
  formData: FormDataItem[];
  urlEncoded: import('./index').KeyValueItem[];
  binary: BinaryBody;
}
