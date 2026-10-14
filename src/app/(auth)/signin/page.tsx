import { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";
import CabinetSignin from "@/components/auth/CabinetSignin";
import { isDevPasswordLoginEnabled } from "@/skillklan/devPasswordLogin";
import { getTranslations } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signinTitle") };
}

// SkillKlan Job has no password sign-in: people come in from the cabinet
// (/auth/cabinet). The upstream form stays for local development only.
export default async function Signin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (isDevPasswordLoginEnabled()) return <AuthCard mode="signin" />;
  const { error } = await searchParams;
  return (
    <CabinetSignin
      cabinetUrl={process.env.CABINET_URL ?? null}
      failed={error === "cabinet"}
    />
  );
}
