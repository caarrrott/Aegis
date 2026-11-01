export interface Citation {
  label: string;
  quote?: string;
}

export interface AskResponse {
  answer: string;
  answered: boolean | null;
  grounded: boolean | null;
  citations: Citation[];
  warnings: string[];
  trace: string[];
}

export interface PolicyDocument {
  id?: string | number;
  title: string;
  department?: string;
  visibility?: string;
  version?: string | number;
  status?: string;
  updated?: string;
  chunks?: number;
}

export interface UploadResult {
  title?: string;
  version?: string | number;
  chunks?: number;
  outcome?: string;
  message?: string;
}

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
};

async function readError(response: Response): Promise<string> {
  let detail: string | undefined;

  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string") detail = data.detail;
    if (Array.isArray(data.detail)) detail = "The request was not accepted.";
  } catch {
    // The body was not JSON; fall through to the status message.
  }

  if (
    response.status === 405 &&
    (!detail || /method not allowed/i.test(detail))
  ) {
    return "This endpoint is not available on the server yet.";
  }
  if (response.status === 404 && (!detail || /not found/i.test(detail))) {
    return "The server could not find that endpoint.";
  }
  if (detail) return detail;
  return `The server responded with ${response.status}.`;
}

function toLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .filter((line) => line.trim() !== "");
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function toCitations(value: unknown, sources: unknown): Citation[] {
  const citations: Citation[] = [];

  if (Array.isArray(value)) {
    for (const raw of value) {
      if (typeof raw === "string") {
        if (raw.trim()) citations.push({ label: raw });
        continue;
      }
      if (typeof raw !== "object" || raw === null) continue;

      const item = raw as Record<string, unknown>;
      const explicit = asString(item.label);
      const title = asString(item.title);
      const version =
        typeof item.version === "number" || typeof item.version === "string"
          ? item.version
          : undefined;
      const section = asString(item.section);

      let label = explicit;
      if (!label && title) {
        label = `${title}${version !== undefined ? ` v${version}` : ""}${
          section ? ` › ${section}` : ""
        }`;
      }
      if (!label) label = asString(item.source) ?? "Document";
      citations.push({ label, quote: asString(item.quote) });
    }
  }

  if (Array.isArray(sources)) {
    for (const source of sources) {
      if (typeof source === "string" && source.trim()) {
        citations.push({ label: source });
      }
    }
  }

  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.label}::${citation.quote ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function askQuestion(
  userId: string,
  text: string,
  signal?: AbortSignal,
): Promise<AskResponse> {
  // The current API reads `text` and `user_id`; the documented shape uses
  // `question` and `username`. Sending both keeps the page working as the
  // API evolves, and unknown fields are ignored by FastAPI.
  const response = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      user_id: userId,
      question: text,
      username: userId,
    }),
    signal,
  });

  if (!response.ok) throw new Error(await readError(response));

  const data = (await response.json()) as Record<string, unknown>;
  const warning = asString(data.warning);

  return {
    answer: asString(data.answer) ?? asString(data.text) ?? "",
    answered: typeof data.answered === "boolean" ? data.answered : null,
    grounded:
      typeof data.fully_grounded === "boolean"
        ? data.fully_grounded
        : typeof data.grounded === "boolean"
          ? data.grounded
          : null,
    citations: toCitations(data.citations, data.sources),
    warnings: [...toLines(data.warnings), ...(warning ? [warning] : [])].filter(
      (item, index, all) => all.indexOf(item) === index,
    ),
    trace: toLines(data.trace),
  };
}

export async function fetchDocuments(signal?: AbortSignal): Promise<PolicyDocument[]> {
  const response = await fetch("/documents", { signal });
  if (!response.ok) throw new Error(await readError(response));

  const payload = (await response.json()) as unknown;
  const rawList = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && "documents" in payload
      ? (payload as { documents: unknown }).documents
      : [];

  if (!Array.isArray(rawList)) return [];

  return rawList
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id:
        typeof item.id === "string" || typeof item.id === "number"
          ? item.id
          : undefined,
      title:
        asString(item.title) ??
        asString(item.source) ??
        asString(item.filename) ??
        "Untitled policy",
      department: asString(item.department),
      visibility: asString(item.visibility),
      version:
        typeof item.version === "string" || typeof item.version === "number"
          ? item.version
          : undefined,
      status: asString(item.status),
      updated:
        asString(item.updated_on) ?? asString(item.updated) ?? asString(item.effective_from),
      chunks: asNumber(item.chunks) ?? asNumber(item.chunk_count),
    }));
}

export async function uploadDocument(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file, file.name);

  const response = await fetch("/documents", { method: "POST", body });
  if (!response.ok) throw new Error(await readError(response));

  let data: Record<string, unknown> = {};
  try {
    const parsed = (await response.json()) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // A successful upload with an empty body is still a success.
  }

  const nested =
    typeof data.document === "object" && data.document !== null
      ? (data.document as Record<string, unknown>)
      : data;

  return {
    title: asString(nested.title) ?? asString(data.title),
    version:
      typeof nested.version === "string" || typeof nested.version === "number"
        ? nested.version
        : undefined,
    chunks: asNumber(nested.chunks) ?? asNumber(nested.chunk_count),
    outcome: asString(nested.outcome) ?? asString(data.outcome) ?? asString(data.status),
    message: asString(data.message) ?? asString(nested.message),
  };
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const response = await fetch("/health");
    return response.ok;
  } catch {
    return false;
  }
}
