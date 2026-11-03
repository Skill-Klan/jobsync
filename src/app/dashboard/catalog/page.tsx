import { notFound } from "next/navigation";
import CatalogAdmin from "@/components/catalog/CatalogAdmin";
import { getCatalogAdminData } from "@/actions/catalog.actions";
import { getFeatureFlags } from "@/skillklan/featureFlags";
import { isAdminSession } from "@/skillklan/cabinetAdmin";

// The admin's page: not there while `catalog` is off, and not there for a
// student — a 404, as for any page that does not exist for them.
async function Catalog() {
  if (!(await getFeatureFlags()).catalog) notFound();
  if (!(await isAdminSession())) notFound();
  const result = await getCatalogAdminData();
  if (!result.success) notFound();
  return (
    <div className="col-span-3">
      <CatalogAdmin entries={result.data.entries} requests={result.data.requests} />
    </div>
  );
}

export default Catalog;
