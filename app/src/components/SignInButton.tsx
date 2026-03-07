import Link from "next/link";

export default function SignInButton({
  className,
  callbackUrl = "/dashboard",
  children = "Sign In →",
}: {
  className?: string;
  callbackUrl?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={`/auth/signin${callbackUrl !== "/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
      className={className}
    >
      {children}
    </Link>
  );
}
