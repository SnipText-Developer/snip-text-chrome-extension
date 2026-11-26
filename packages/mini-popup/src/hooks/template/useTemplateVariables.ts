import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ConnectPopupKeyboard } from "../popup/usePopupEventIsolation";
import type { Template } from "../../types";
import { useAutoFocusTarget } from "../keyboard/useAutoFocusTarget";
import { usePopupKeyboard } from "../keyboard/usePopupKeyboard";
import { useTemplateContent } from "./useTemplateContent";

export function useTemplateVariables(
  { connectKeyboard, enabled, template, busy, onCancel, onInsert }: {
    connectKeyboard: ConnectPopupKeyboard;
    enabled: boolean;
    template: Template;
    busy?: boolean;
    onCancel: () => void;
    onInsert: (text: string) => void;
  },
) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.variables.map((name) => [name, ""])),
  );
  const [invalidVariable, setInvalidVariable] = useState<string>();
  const focus = useAutoFocusTarget<string>(template.variables[0], enabled);
  const errorId = useId();
  const content = useTemplateContent(template.content, values);
  const composing = useRef(false);
  const ref = usePopupKeyboard<HTMLFormElement>(connectKeyboard, enabled, (input, inside) => {
    if (busy || input.key !== "Escape" || input.isComposing || (inside && composing.current)) return;
    onCancel();
    return true;
  });

  return {
    errorId,
    getField(variable: string) {
      const invalid = variable === invalidVariable;
      const { key, autoFocus } = focus.getFocusProps(variable);
      return {
        key,
        invalid,
        inputProps: {
          autoFocus,
          name: variable,
          value: values[variable] ?? "",
          "aria-invalid": invalid || undefined,
          "aria-describedby": invalid ? errorId : undefined,
          onInput(event: FormEvent<HTMLInputElement>) {
            const value = event.currentTarget.value;
            setValues((previous) => ({ ...previous, [variable]: value }));
            if (invalid && value.trim()) setInvalidVariable(undefined);
          },
        },
      };
    },
    formProps: {
      ref,
      noValidate: true,
      onCompositionStart() { composing.current = true; },
      onCompositionEnd() { composing.current = false; },
      onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (composing.current || busy) return;
        const missing = template.variables.find((variable) => !values[variable]?.trim());
        if (missing !== undefined) {
          setInvalidVariable(missing);
          focus.requestFocus(missing);
          return;
        }
        onInsert(content);
      },
    },
  };
}
