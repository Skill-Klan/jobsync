"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";
import { APP_CONSTANTS } from "@/lib/constants";
import { resolveContactRole } from "@/lib/jobs/resolve";
import { getTranslations } from "@/i18n/server";
import { isFeatureOff } from "@/skillklan/featureFlags";

export const getAllContactRoles = async (): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    return await prisma.contactRole.findMany({
      where: { createdBy: user.id },
      orderBy: { label: "asc" },
    });
  } catch (error) {
    return handleError(error, "Failed to fetch contact roles. ");
  }
};

// Not getReferenceEntityList: that helper counts jobs grouped by an FK on Job,
// and a role reaches Job only through JobContact.
export const getContactRoleList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
  search?: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const whereClause: any = { createdBy: user.id };
    if (search) {
      whereClause.label = { contains: search };
    }

    const [data, total] = await Promise.all([
      prisma.contactRole.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { jobContacts: true, contacts: true } } },
        orderBy: [{ label: "asc" }],
      }),
      prisma.contactRole.count({ where: whereClause }),
    ]);

    return { data, total };
  } catch (error) {
    return handleError(error, "Failed to fetch contact role list. ");
  }
};

export const createContactRole = async (
  label: string,
): Promise<any | undefined> => {
  const t = await getTranslations("library");
  try {
    const user = await requireUser();
    const role = await resolveContactRole(label, user.id);
    return { success: true, data: role };
  } catch (error) {
    return handleError(error, t("errors.role.createFailed"));
  }
};

export const deleteContactRoleById = async (
  roleId: string,
): Promise<any | undefined> => {
  const t = await getTranslations("library");
  try {
    const user = await requireUser();
    // Deleting happens only in the Library. Switched off (Settings →
    // «Функції»): a page opened before still has its buttons — refuse here too.
    if (await isFeatureOff("library")) {
      return { success: false, message: t("errors.switchedOff") };
    }

    // JobContact.roleId is required, so the database already refuses via the
    // default Restrict; this turns that into a counted, readable message.
    const links = await prisma.jobContact.count({
      where: { roleId, Job: { userId: user.id } },
    });
    if (links > 0) {
      throw new Error(t("errors.role.hasLinks", { count: links }));
    }

    // Contact.roleId is SetNull, so without this guard deleting a role would
    // silently clear it on every contact that holds it.
    const holders = await prisma.contact.count({
      where: { roleId, createdBy: user.id },
    });
    if (holders > 0) {
      throw new Error(t("errors.role.hasHolders", { count: holders }));
    }

    const res = await prisma.contactRole.delete({
      where: { id: roleId, createdBy: user.id },
    });
    return { res, success: true };
  } catch (error) {
    return handleError(error, t("errors.role.deleteFailed"));
  }
};
