import ProfileContainer from "@/components/profile/ProfileContainer";
import React from "react";
import type { Metadata } from "next";
import { getTranslations } from "@/i18n/server";

// The tab title: the page's name (the layout adds «| SkillKlan Job»).
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("profile") };
}

function Profile() {
  return (
    <div className="col-span-3">
      <ProfileContainer />
    </div>
  );
}

export default Profile;
