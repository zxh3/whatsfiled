import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInPageClient } from "./sign-in-page-client";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to access WhatsFiled admin features.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInPageClient />
    </Suspense>
  );
}
