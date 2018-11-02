// EngineSchemaProvider (engine schema reg => schema)
import { NotificationHandler } from "vscode-languageserver";

import gql from "graphql-tag";

import { GraphQLSchema, buildClientSchema } from "graphql";

import { ApolloEngineClient } from "../../engine";
import { ClientConfigFormat, parseServiceSpecificer } from "../../config";
import { GraphQLSchemaProvider, SchemaChangeUnsubscribeHandler } from "./base";

export class EngineSchemaProvider implements GraphQLSchemaProvider {
  private schema?: GraphQLSchema;
  private client?: ApolloEngineClient;
  constructor(private config: ClientConfigFormat) {}
  async resolveSchema() {
    if (this.schema) return this.schema;
    const { engine, client } = this.config;

    if (typeof client.service !== "string") {
      throw new Error(
        `Service name not found for client, found ${client.service}`
      );
    }

    // create engine client
    if (!this.client) {
      if (!engine || !engine.engineApiKey) {
        throw new Error("ENGINE_API_KEY not found");
      }
      this.client = new ApolloEngineClient(
        engine.engineApiKey,
        engine.endpoint
      );
    }

    const [id, tag] = parseServiceSpecificer(client.service);
    const { data, errors } = await this.client.execute({
      query: SCHEMA_QUERY,
      variables: {
        id,
        tag
      }
    });

    if (errors) {
      // XXX better error handling of GraphQL errors
      throw new Error(errors.map(({ message }: Error) => message).join("\n"));
    }

    if (!data || !data.service.schema) {
      throw new Error(
        `Unable to get schema from Apollo Engine for service ${id}`
      );
    }

    this.schema = buildClientSchema(data.service.schema);
    return this.schema;
  }

  onSchemaChange(
    handler: NotificationHandler<GraphQLSchema>
  ): SchemaChangeUnsubscribeHandler {
    throw new Error("Polling of Engine not implemented yet");
    return () => {};
  }
}

export const SCHEMA_QUERY = gql`
  query GetSchemaByTag($id: ID!, $tag: String!) {
    service(id: $id) {
      schema(tag: $tag) {
        hash
        __schema: introspection {
          queryType {
            name
          }
          mutationType {
            name
          }
          subscriptionType {
            name
          }
          types(filter: { includeAbstractTypes: true }) {
            ...IntrospectionFullType
          }
          directives {
            name
            description
            locations
            args {
              ...IntrospectionInputValue
            }
          }
        }
      }
    }
  }

  fragment IntrospectionFullType on IntrospectionType {
    kind
    name
    description
    fields {
      name
      description
      args {
        ...IntrospectionInputValue
      }
      type {
        ...IntrospectionTypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...IntrospectionInputValue
    }
    interfaces {
      ...IntrospectionTypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      depreactionReason
    }
    possibleTypes {
      ...IntrospectionTypeRef
    }
  }

  fragment IntrospectionInputValue on IntrospectionInputValue {
    name
    description
    type {
      ...IntrospectionTypeRef
    }
    defaultValue
  }

  fragment IntrospectionTypeRef on IntrospectionType {
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
      }
    }
  }
`;
