"use client";

import { signIn } from "next-auth/react";

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
    <button
      onClick={() => signIn("google", { callbackUrl })}
      className={className}
    >
      {children}
    </button>
  );
}
