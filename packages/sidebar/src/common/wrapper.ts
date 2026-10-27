import type { MessageResponse } from "../core/message-types";

function tryCatch<T>(fn: () => T): T | MessageResponse {
  try {
    return fn();
  } catch (error) {
    return {
      statusCode: 500,
      data: { msg: JSON.stringify(error) },
    };
  }
}

async function tryCatchAsync<T>(
  fn: () => Promise<T>,
): Promise<T | MessageResponse> {
  return fn().catch((error) => {
    return {
      statusCode: 500,
      data: { msg: JSON.stringify(error) },
    };
  });
}

export { tryCatch, tryCatchAsync };
