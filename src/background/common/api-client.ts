import { snipTextApiOrigin } from "../../config/api";
import { service as authService } from "../auth/service";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requestApi(url: string, method = "GET", body?: unknown): Promise<unknown> {
  const headers = new Headers({ Accept: "application/json" });
  const production = new URL(url).origin === snipTextApiOrigin;
  if (production) {
    const auth = await authService.readLatest();
    if (!auth) throw new ApiError(401, "로그인 후 다시 시도해주세요.");
    headers.set("Authorization", `Bearer ${auth.token}`);
  }
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    redirect: production ? "error" : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 401) {
    throw new ApiError(401, "인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.");
  }
  if (!response.ok) throw new ApiError(response.status, `API 요청 실패 (${response.status})`);

  const payload: unknown = await response.json();
  if (!production) return payload;
  if (payload && typeof payload === "object" && "isSuccess" in payload &&
      payload.isSuccess === true && "result" in payload) {
    return payload.result;
  }
  throw new ApiError(500, "API 응답을 처리하지 못했습니다.");
}
