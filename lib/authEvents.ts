type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();
let lastUnauthorizedAt = 0;

export function subscribeAuthUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function emitAuthUnauthorized(): void {
  const now = Date.now();
  if (now - lastUnauthorizedAt < 1000) {
    return;
  }
  lastUnauthorizedAt = now;

  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}
