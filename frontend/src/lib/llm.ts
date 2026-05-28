/**
 * LLM service — unified client for OpenAI-compatible endpoints.
 *
 * Configure via env:
 *   FORGE_API_URL        — e.g. https://forge.manus.im (no /v1/...)
 *   FORGE_API_KEY        — bearer token
 *
 * Falls back to https://forge.manus.im if FORGE_API_URL is unset.
 *
 * @example
 * ```ts
 * import { invokeLLM } from "@/lib/llm";
 *
 * const result = await invokeLLM({
 *   messages: [
 *     { role: "system", content: "You are helpful." },
 *     { role: "user", content: "Hello" },
 *   ],
 * });
 * console.log(result.choices[0].message.content);
 * ```
 */

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = { type: "function"; function: { name: string } };
export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  model?: string;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

const ensureArray = (v: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(v) ? v : [v];

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map((p) => (typeof p === "string" ? p : JSON.stringify(p)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const parts = ensureArray(message.content).map(normalizeContentPart);
  if (parts.length === 1 && parts[0].type === "text") {
    return { role, name, content: parts[0].text };
  }
  return { role, name, content: parts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' requires at least one tool");
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs exactly one tool, or specify the tool name"
      );
    }
    return { type: "function", function: { name: tools[0].function.name } };
  }

  if ("name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }

  return toolChoice;
};

const getApiUrl = (): string => {
  const base = process.env.FORGE_API_URL?.trim();
  if (!base) return "https://forge.manus.im/v1/chat/completions";
  return `${base.replace(/\/$/, "")}/v1/chat/completions`;
};

const getApiKey = (): string => {
  const key = process.env.FORGE_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("FORGE_API_KEY (or OPENAI_API_KEY) is not configured");
  return key;
};

const normalizeResponseFormat = (params: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}): ResponseFormat | undefined => {
  const explicit = params.responseFormat || params.response_format;
  if (explicit) {
    if (explicit.type === "json_schema" && !explicit.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a schema object");
    }
    return explicit;
  }

  const schema = params.outputSchema || params.output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

/**
 * Invoke the LLM. Returns the OpenAI-compatible response.
 * Throws on network or auth failure.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = getApiKey();

  const payload: Record<string, unknown> = {
    model: params.model ?? "gemini-2.5-flash",
    messages: params.messages.map(normalizeMessage),
    max_tokens: params.maxTokens ?? params.max_tokens ?? 8192,
  };

  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
  }

  const tc = normalizeToolChoice(params.toolChoice || params.tool_choice, params.tools);
  if (tc) payload.tool_choice = tc;

  const rf = normalizeResponseFormat(params);
  if (rf) payload.response_format = rf;

  const response = await fetch(getApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText}${errorText ? ` — ${errorText}` : ""}`
    );
  }

  return (await response.json()) as InvokeResult;
}
