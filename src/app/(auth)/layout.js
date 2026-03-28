/**
 * Layout for the (auth) route group — renders pages without the main
 * sidebar + topbar shell so auth pages (signup, login) get a full-screen canvas.
 */
export default function AuthLayout({ children }) {
  return <>{children}</>;
}
