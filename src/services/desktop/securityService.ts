import { KeyringStatus, NativeProxyConfig } from '../../types';
import { invokeDesktop } from './tauriBridge';

class DesktopSecurityService {
  public async getKeyringStatus(): Promise<KeyringStatus> {
    return invokeDesktop<KeyringStatus>('keyring_status');
  }

  public async generateCredentialRef(prefix: string): Promise<string> {
    return invokeDesktop<string>('generate_credential_ref', { prefix });
  }

  public async storeSecret(reference: string, secretValue: string): Promise<void> {
    return invokeDesktop<void>('store_secret', { reference, secretValue });
  }

  public async getSecret(reference: string): Promise<string | null> {
    return invokeDesktop<string | null>('get_secret', { reference });
  }

  public async deleteSecret(reference: string): Promise<boolean> {
    return invokeDesktop<boolean>('delete_secret', { reference });
  }

  public async setGlobalProxyConfig(config: NativeProxyConfig | null): Promise<void> {
    return invokeDesktop<void>('set_global_proxy_config', { config });
  }

  public async getGlobalProxyConfig(): Promise<NativeProxyConfig | null> {
    return invokeDesktop<NativeProxyConfig | null>('get_global_proxy_config');
  }
}

export const desktopSecurityService = new DesktopSecurityService();
