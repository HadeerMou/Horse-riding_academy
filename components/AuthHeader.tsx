import Link from "next/link";

export default function AuthHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="auth-header">
      <Link className="brand" href="/" aria-label="Nocturne Riding Academy home">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M13 9v16c0 10 4 15 11 15s11-5 11-15V9M13 17h7M28 17h7" />
        </svg>
        <span>NOCTURNE</span>
        <small>RIDING ACADEMY</small>
      </Link>
      {children}
    </header>
  );
}
