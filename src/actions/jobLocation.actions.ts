"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { requireUser } from "./shared";
import { APP_CONSTANTS } from "@/lib/constants";
import { getReferenceEntityList } from "./referenceList";
import { getTranslations } from "@/i18n/server";

export const getAllJobLocations = async (): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const list = await prisma.location.findMany({
      where: {
        createdBy: user.id,
      },
    });
    return list;
  } catch (error) {
    const msg = "Failed to fetch job location list. ";
    return handleError(error, msg);
  }
};

export const getJobLocationsList = async (
  page: number = 1,
  limit: number = APP_CONSTANTS.RECORDS_PER_PAGE,
  countBy?: string,
  search?: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    return await getReferenceEntityList({
      model: prisma.location,
      userId: user.id,
      fkField: "locationId",
      appliedRelation: "jobsApplied",
      page,
      limit,
      countBy,
      search,
    });
  } catch (error) {
    const msg = "Failed to fetch job location list. ";
    return handleError(error, msg);
  }
};

export const deleteJobLocationById = async (
  locationId: string
): Promise<any | undefined> => {
  const t = await getTranslations("library");
  try {
    const user = await requireUser();

    const experiences = await prisma.workExperience.count({
      where: {
        locationId,
      },
    });
    if (experiences > 0) {
      throw new Error(t("errors.location.inExperience"));
    }

    const educations = await prisma.education.count({
      where: {
        locationId,
      },
    });
    if (educations > 0) {
      throw new Error(t("errors.location.inEducation"));
    }

    const jobs = await prisma.job.count({
      where: {
        locationId,
        userId: user.id,
      },
    });

    if (jobs > 0) {
      throw new Error(t("errors.location.hasJobs", { count: jobs }));
    }

    // Optional relation, so the Prisma default is SetNull; same reasoning as
    // the company guard — nothing at the database level blocks this.
    const contacts = await prisma.contact.count({
      where: { locationId, createdBy: user.id },
    });
    if (contacts > 0) {
      throw new Error(t("errors.location.hasContacts", { count: contacts }));
    }

    const res = await prisma.location.delete({
      where: {
        id: locationId,
        createdBy: user.id,
      },
    });
    return { res, success: true };
  } catch (error) {
    const msg = t("errors.location.deleteFailed");
    return handleError(error, msg);
  }
};
