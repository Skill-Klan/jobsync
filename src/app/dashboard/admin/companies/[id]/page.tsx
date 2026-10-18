import { notFound } from "next/navigation";
import { getCompanyDetails } from "@/actions/company.actions";
import CompanyDetails from "@/components/admin/CompanyDetails";
import { getFeatureFlags } from "@/skillklan/featureFlags";

async function CompanyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Part of the Library: off in Settings → «Функції» — not there for anyone
  // (D76); job lists then show the company name as plain text.
  if (!(await getFeatureFlags()).library) notFound();
  const { id } = await params;
  const details = await getCompanyDetails(id);

  // null (missing or not yours) and a failed read both land here
  if (!details?.id) notFound();

  return (
    <div className="col-span-3">
      <CompanyDetails details={details} />
    </div>
  );
}

export default CompanyDetailsPage;
