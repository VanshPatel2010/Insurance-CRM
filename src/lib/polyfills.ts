/**
 * polyfills.ts — Browser compatibility polyfills
 *
 * Import this module BEFORE any library that may use modern JS APIs.
 * Currently polyfills:
 *   - Promise.withResolvers() — ES2024, required by pdfjs-dist v5+
 *     Not available in: Chrome < 119, Firefox < 121, Safari < 17.2, Edge < 119
 */

export function applyPolyfills(): void {
  // ── Promise.withResolvers ─────────────────────────────────────────────────
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
  if (typeof Promise.withResolvers !== 'function') {
    Promise.withResolvers = function <T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    } {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };

    console.log('[polyfills] Promise.withResolvers polyfilled for browser compatibility');
  }
}

// Auto-apply when this module is imported
applyPolyfills();
