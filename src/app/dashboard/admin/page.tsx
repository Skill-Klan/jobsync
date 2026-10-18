import { notFound } from "next/navigation";
import AdminTabsContainer from "@/components/admin/AdminTabsContainer";
import { getTranslations } from "@/i18n/server";
import { getFeatureFlags } from "@/skillklan/featureFlags";

// The Library («Довідники»). Switched off in Settings → «Функції» — the page is
// not there for anyone, the admin included; the lists stay and keep filling up
// from forms.
async function AdminPage() {
  if (!(await getFeatureFlags()).library) notFound();
  const t = await getTranslations("library");
  return (
    <div className="flex flex-col col-span-3">
      <h3 className="text-2xl font-semibold leading-none tracking-tight mb-4">
        {t("page.title")}
      </h3>
      <AdminTabsContainer />
    </div>
  );
}

export default AdminPage;
