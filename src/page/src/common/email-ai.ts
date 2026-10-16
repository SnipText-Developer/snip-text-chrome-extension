export type EmailInput = {
  senderName: string;
  recipientName: string;
  details: string;
};
export type Settings = { language: string };
let active = false;

export function getProxyUrl() {
  const configured = import.meta.env.VITE_AI_PROXY_URL?.trim();
  if (!configured)
    throw new Error(
      "AI 서버 주소가 설정되지 않았습니다. VITE_AI_PROXY_URL을 설정해주세요.",
    );
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("AI 서버 주소는 전체 HTTP 또는 HTTPS URL이어야 합니다.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error("AI 서버 주소 형식을 확인해주세요.");
  return url.href;
}

type Completion = {
  choices: { finish_reason?: string; message: { content: string | null } }[];
};
async function requestCompletion(
  endpoint: string,
  request: unknown,
  signal: AbortSignal,
  label: string,
): Promise<Completion> {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 180_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`서버 요청 실패 (HTTP ${response.status})`);
    const data: unknown = await response.json();
    controller.signal.throwIfAborted();
    const choice = (data as Completion | null)?.choices?.[0];
    if (
      !choice ||
      !choice.message ||
      (typeof choice.message.content !== "string" &&
        choice.message.content !== null)
    )
      throw new Error("서버 응답 형식이 올바르지 않습니다.");
    return data as Completion;
  } catch (error) {
    signal.throwIfAborted();
    if (timedOut)
      throw new Error(`${label} 응답이 3분 안에 완료되지 않았습니다.`);
    throw new Error(
      `${label} API 호출 실패: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

function normalizeNotes(text: string) {
  // Normalize representation, not meaning: keep paragraph structure and facts.
  return text
    .normalize("NFC")
    .replace(/\r\n?|\u2028|\u2029/g, "\n")
    .trim();
}

export async function generate(
  settings: Settings,
  input: EmailInput,
  signal: AbortSignal,
  stage: (label: string) => void = () => {},
) {
  if (!["ko", "en"].includes(settings.language))
    throw new Error("지원하지 않는 언어입니다.");

  const senderName = normalizeNotes(input.senderName);
  if (
    !senderName ||
    input.senderName.length > 100 ||
    /[\r\n\u2028\u2029]/.test(input.senderName)
  )
    throw new Error("보내는 사람 이름을 줄바꿈 없이 1~100자로 입력해주세요.");

  const recipientName = normalizeNotes(input.recipientName);
  if (
    !recipientName ||
    input.recipientName.length > 100 ||
    /[\r\n\u2028\u2029]/.test(input.recipientName)
  )
    throw new Error(
      "받는 사람 이름 또는 호칭을 줄바꿈 없이 1~100자로 입력해주세요.",
    );

  const details = normalizeNotes(input.details);
  if (!details || details.length > 4000)
    throw new Error("상세 본문 관련 내용을 1~4,000자로 입력해주세요.");

  const endpoint = getProxyUrl();
  signal.throwIfAborted();
  if (active) throw new Error("AI 작업이 이미 진행 중입니다.");
  active = true;
  try {
    stage("AI 메일 작성 중…");
    const response = await requestCompletion(
      endpoint,
      {
        senderName,
        recipientName,
        details,
        language: settings.language,
      },
      signal,
      "메일 생성",
    );
    signal.throwIfAborted();
    const choice = response.choices[0];
    if (choice.finish_reason === "length")
      throw new Error(
        "메일 생성이 길이 제한으로 중단되었습니다. 다시 시도해주세요.",
      );
    const result = choice.message.content?.trim();
    if (!result)
      throw new Error("메일이 생성되지 않았습니다. 다시 시도해주세요.");
    return result;
  } finally {
    active = false;
  }
}
