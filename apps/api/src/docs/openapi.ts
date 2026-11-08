import { z } from "zod";
import { routeRegistry, type RegisteredRoute } from "../lib/route";

type JsonSchema = Record<string, unknown>;

/** Zod → JSON Schema for request input (what the client sends, before coercion). */
function toJsonSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as JsonSchema;
  delete json.$schema;
  return json;
}

function queryParameters(schema: z.ZodType) {
  const json = toJsonSchema(schema) as {
    properties?: Record<string, JsonSchema>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, prop]) => ({
    name,
    in: "query",
    required: json.required?.includes(name) ?? false,
    schema: prop,
  }));
}

function pathParameters(path: string) {
  return [...path.matchAll(/:(\w+)/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

const ACCESS_TEXT: Record<RegisteredRoute["access"], string> = {
  public: "Public.",
  optional: "Guests or signed-in users.",
  user: "Requires a signed-in user.",
  SUPPORT: "Requires role **SUPPORT** or higher.",
  MANAGER: "Requires role **MANAGER** or higher.",
  SUPER_ADMIN: "Requires role **SUPER_ADMIN**.",
};

function operation(r: RegisteredRoute) {
  const secured = r.access !== "public";
  const success = String(r.status ?? 200);

  return {
    tags: [r.tag],
    summary: r.summary,
    description: [
      ACCESS_TEXT[r.access],
      r.description,
      r.rateLimit ? `Rate limited (\`${r.rateLimit}\`).` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    operationId: `${r.method}_${r.fullPath.replace(/^\/api\/v1\//, "").replace(/[/:-]+/g, "_")}`,
    ...(secured ? { security: [{ cookieAuth: [] }, { bearerAuth: [] }] } : {}),
    parameters: [...pathParameters(r.fullPath), ...(r.query ? queryParameters(r.query) : [])],
    ...(r.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: toJsonSchema(r.body) } },
          },
        }
      : {}),
    responses: {
      [success]: { description: success === "204" ? "No content" : "Success" },
      ...(r.body || r.query ? { 422: { $ref: "#/components/responses/ValidationError" } } : {}),
      ...(secured ? { 401: { $ref: "#/components/responses/Unauthorized" } } : {}),
      ...(r.access !== "public" && r.access !== "optional" && r.access !== "user"
        ? { 403: { $ref: "#/components/responses/Forbidden" } }
        : {}),
      ...(r.rateLimit ? { 429: { $ref: "#/components/responses/RateLimited" } } : {}),
    },
  };
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

/** Builds the OpenAPI 3.1 document from every route registered with `defineRoutes`. */
export function buildOpenApiSpec(serverUrl = "/") {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routeRegistry) {
    const path = r.fullPath.replace(/:(\w+)/g, "{$1}") || "/";
    (paths[path] ??= {})[r.method] = operation(r);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Urban Store API",
      version: "1.0.0",
      description:
        "REST API for the Urban Store storefront and admin.\n\n" +
        "- **Auth:** sign in with `POST /auth/login`. Browsers use httpOnly cookies; other clients can send `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes; on a 401 with `details.reason = TOKEN_EXPIRED`, call `POST /auth/refresh`.\n" +
        "- **Money** is always an integer in minor units (paisa): `349900` = Rs 3,499.\n" +
        "- **Responses:** `{ data }` or `{ data, meta }` on success, `{ error: { code, message, details, requestId } }` on failure.",
    },
    servers: [{ url: serverUrl }],
    tags: [...new Set(routeRegistry.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "access_token" },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", examples: ["VALIDATION_ERROR"] },
                message: { type: "string" },
                details: {},
                requestId: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        ValidationError: errorResponse(
          "Validation failed (`details.fieldErrors` lists each field)",
        ),
        Unauthorized: errorResponse("Not signed in, or the session expired"),
        Forbidden: errorResponse("Signed in, but the role is not allowed"),
        RateLimited: errorResponse("Too many requests"),
      },
    },
  };
}
