import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../common/message-bus";
import "./InsertBodyButton.css";

interface Props {
  text: string;
  disabled?: boolean;
  type?: "button" | "submit";
  label?: string;
  title?: string;
  beforeInsert?: () => boolean;
  onPendingChange?: (pending: boolean) => void;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export default function InsertBodyButton({
  text,
  disabled = false,
  type = "button",
  label = "본문에 삽입",
  title,
  beforeInsert,
  onPendingChange,
  onSuccess,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function insert() {
    if (pending.current || disabled || !text || beforeInsert?.() === false)
      return;
    pending.current = true;
    setLoading(true);
    setNotice("");
    onPendingChange?.(true);
    try {
      const response = await sendMessage({
        src: "PAGE",
        dst: "BACKGROUND",
        method: "PUT",
        path: "/editor/insert-text",
        data: { text },
      });
      if (response?.statusCode !== 200)
        throw new Error(
          response?.data?.msg ??
            "삽입하지 못했습니다. 메일 작성 창을 확인하고 다시 시도해주세요.",
        );
      if (mounted.current) {
        setNotice("본문에 삽입했습니다.");
        onSuccess?.();
      }
    } catch (error) {
      if (mounted.current) {
        const message =
          error instanceof Error ? error.message : "본문 삽입에 실패했습니다.";
        setNotice(message);
        onError?.(message);
      }
    } finally {
      pending.current = false;
      if (mounted.current) {
        setLoading(false);
        onPendingChange?.(false);
      }
    }
  }

  return (
    <>
      <button
        className="insert-body-button"
        type={type}
        onClick={(event) => {
          event.preventDefault();
          if (
            !event.currentTarget.form ||
            event.currentTarget.form.reportValidity()
          )
            void insert();
        }}
        disabled={disabled || !text}
        title={title}
        aria-busy={loading}>
        {label}
      </button>
      {!onSuccess && !onError && (
        <span className="insert-body-notice" role="status">
          {notice}
        </span>
      )}
    </>
  );
}
