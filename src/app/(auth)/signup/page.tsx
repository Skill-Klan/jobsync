import { Metadata } from "next";
import { notFound } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import { isDevPasswordLoginEnabled } from "@/skillklan/devPasswordLogin";

export const metadata: Metadata = {
  title: "Sign Up",
};

// Accounts are created by the cabinet login, not by sign-up. The page — and
// the signup action behind it — exist for local development only.
export default function Signup() {
  if (!isDevPasswordLoginEnabled()) notFound();
  return <AuthCard mode="signup" />;
}
