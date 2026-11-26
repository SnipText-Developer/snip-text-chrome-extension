import { useLayoutEffect, useRef, useState } from "react";

export function useAutoFocusTarget<T extends string | number>(initialTarget: T | undefined, enabled: boolean) {
  const [request, setRequest] = useState({ target: initialTarget, version: 0 });
  const applied = useRef<typeof request | undefined>(undefined);

  useLayoutEffect(() => {
    applied.current = request;
  }, [request]);

  return {
    requestFocus(target: T) {
      setRequest((previous) => ({ target, version: previous.version + 1 }));
    },
    getFocusProps(target: T, key: string | number = target) {
      const requested = target === request.target;
      // A fresh key lets React apply autoFocus when it mounts the requested control.
      return {
        key: requested ? `${key}:${request.version}` : `${key}:`,
        autoFocus: enabled && requested && applied.current !== request,
      };
    },
  };
}
