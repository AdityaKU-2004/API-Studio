import {
  ApiRequest,
  GraphQLIntrospectionSchema,
  GraphQLTypeRef,
} from '../../../types';
import { graphqlClient } from './graphqlClient';

export const GRAPHQL_INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        kind
        name
        description
        fields(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
          args {
            name
            description
            defaultValue
            type { ...TypeRef }
          }
          type { ...TypeRef }
        }
        inputFields {
          name
          description
          defaultValue
          type { ...TypeRef }
        }
        interfaces { name }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
        }
        possibleTypes { name }
      }
    }
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
          }
        }
      }
    }
  }
`;

export function formatGraphQLTypeRef(ref?: GraphQLTypeRef | null): string {
  if (!ref) return 'Unknown';
  if (ref.kind === 'NON_NULL') return `${formatGraphQLTypeRef(ref.ofType)}!`;
  if (ref.kind === 'LIST') return `[${formatGraphQLTypeRef(ref.ofType)}]`;
  return ref.name || 'Unknown';
}

export function parseIntrospectionResult(
  endpoint: string,
  data: any
): GraphQLIntrospectionSchema | null {
  const schema = data?.__schema;
  if (!schema || !Array.isArray(schema.types)) return null;

  return {
    endpoint,
    fetchedAt: Date.now(),
    queryTypeName: schema.queryType?.name || null,
    mutationTypeName: schema.mutationType?.name || null,
    subscriptionTypeName: schema.subscriptionType?.name || null,
    types: schema.types.filter((t: any) => t?.name && !String(t.name).startsWith('__')),
  };
}

export async function fetchGraphQLIntrospectionSchema(
  request: ApiRequest,
  endpoint: string,
  resolvedVariables: Record<string, string>,
  tabId: string
): Promise<{
  schema: GraphQLIntrospectionSchema | null;
  disabledOrError?: string;
}> {
  const { gqlResponse } = await graphqlClient.execute({
    tabId: `${tabId}-introspect`,
    request,
    graphql: {
      endpoint,
      method: 'POST',
      query: GRAPHQL_INTROSPECTION_QUERY,
      variablesText: '{}',
      operationName: 'IntrospectionQuery',
      queryHistory: [],
    },
    resolvedVariables,
  });

  if (gqlResponse.isNetworkError) {
    return {
      schema: null,
      disabledOrError:
        gqlResponse.networkErrorMessage || 'Network failure while querying GraphQL endpoint.',
    };
  }

  if (gqlResponse.errors.length > 0 && !(gqlResponse.data as any)?.__schema) {
    const msg = gqlResponse.errors.map((e) => e.message).join(' | ');
    const looksDisabled =
      msg.toLowerCase().includes('introspection') ||
      gqlResponse.httpStatus === 400 ||
      gqlResponse.httpStatus === 403;
    return {
      schema: null,
      disabledOrError: looksDisabled
        ? `Schema introspection appears disabled or restricted by this server: ${msg}`
        : msg,
    };
  }

  const parsed = parseIntrospectionResult(endpoint, gqlResponse.data);
  if (!parsed) {
    return {
      schema: null,
      disabledOrError: 'Endpoint did not return a valid __schema introspection response.',
    };
  }

  return { schema: parsed };
}
