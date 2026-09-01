import React from "react";

/**
 * Sign in and sign up run chrome-free: no header, no cart, no footer, so the
 * form is the only thing on screen.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex-1">{children}</main>;
}
