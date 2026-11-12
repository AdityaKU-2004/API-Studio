export type AuthType = 'inherit' | 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo?: 'header' | 'query';
  in?: 'header' | 'query';
  enabled: boolean;
}

export interface BearerAuth {
  token: string;
  prefix?: string;
  visible?: boolean;
}

export interface BasicAuth {
  username: string;
  password: string;
  visible?: boolean;
}

export type OAuth2GrantType =
  | 'authorization_code'
  | 'authorization_code_pkce'
  | 'client_credentials'
  | 'password';

export interface OAuth2Auth {
  grantType: OAuth2GrantType;
  authUrl: string;
  accessTokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  redirectUri: string;
  state?: string;
  clientAuthMethod: 'header' | 'body';
  username?: string; // for legacy password grant
  password?: string; // for legacy password grant
  token?: string;
  accessToken?: string;
}

export interface AuthConfig {
  type: AuthType;
  apikey?: ApiKeyAuth;
  apiKey?: ApiKeyAuth; // alias
  bearer?: BearerAuth;
  basic?: BasicAuth;
  oauth2?: OAuth2Auth;
}
