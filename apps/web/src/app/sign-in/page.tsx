import type { Metadata } from "next";
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
  return <SignInPageClient />;
}
