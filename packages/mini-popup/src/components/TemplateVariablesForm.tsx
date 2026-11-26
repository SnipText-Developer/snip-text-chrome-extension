import styles from "./TemplateVariablesForm.css?inline";
import type { ConnectPopupKeyboard } from "../hooks/popup/usePopupEventIsolation";
import type { Template } from "../types";
import { useTemplateVariables } from "../hooks/template/useTemplateVariables";

interface Props {
  connectKeyboard: ConnectPopupKeyboard;
  enabled: boolean;
  template: Template;
  busy?: boolean;
  onCancel: () => void;
  onInsert: (text: string) => void;
}

const examples: Record<string, string> = { 날짜: "예: 11월 25일", 시간: "예: 오후 2시" };

export function TemplateVariablesForm(props: Props) {
  const { template, busy } = props;
  const { errorId, getField, formProps } = useTemplateVariables(props);

  return (
    <>
      <style>{styles}</style>
      <form {...formProps}>
        <div className="list variables">
          <div className="fields">
            {template.variables.map((variable) => {
              const { key, invalid, inputProps } = getField(variable);
              return (
                <label key={variable}>
                  <span>{variable}</span>
                  <input
                    key={key}
                    {...inputProps}
                    type="text"
                    required
                    disabled={busy}
                    placeholder={Object.hasOwn(examples, variable) ? examples[variable] : `${variable} 입력`}
                  />
                  {invalid && <span id={errorId} className="field-error" role="alert">{variable} 값을 입력해 주세요.</span>}
                </label>
              );
            })}
          </div>
          <p className="variable-hint">모든 입력칸을 채워 주세요.</p>
        </div>
        <footer className="popup-footer variable-keys">
          <button type="submit" disabled={busy}>{busy ? "삽입 중…" : "Enter 삽입"}</button>
          <span>Tab 다음 항목</span>
          <span>Esc 닫기</span>
        </footer>
      </form>
    </>
  );
}
