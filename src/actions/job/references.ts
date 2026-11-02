"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { canonicalizeEntityValue } from "@/lib/jobs/canonicalize";
import { JOB_SOURCES, JOB_STATUSES } from "@/lib/constants";
import { sortByDefaultOrder } from "@/lib/jobs/sortByDefaultOrder";
import { requireUser } from "../shared";
import { jobsError } from "./errorMessages";

// JobStatus is global reference data with no createdBy column, so unlike every
// other list here it is not scoped to the current user. Sorted in JS because
// rows are in insertion order, and migrations insert some before signup.
export const getStatusList = async (): Promise<any | undefined> => {
  try {
    const statuses = await prisma.jobStatus.findMany();
    return sortByDefaultOrder(statuses, JOB_STATUSES);
  } catch (error) {
    const msg = await jobsError("fetchStatuses");
    return handleError(error, msg);
  }
};

export const getJobSourceList = async (): Promise<any | undefined> => {
  try {
    const user = await requireUser();
    const list = await prisma.jobSource.findMany({
      where: {
        createdBy: user.id,
      },
    });
    return sortByDefaultOrder(list, JOB_SOURCES);
  } catch (error) {
    const msg = await jobsError("fetchSources");
    return handleError(error, msg);
  }
};

export const createLocation = async (
  label: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const value = canonicalizeEntityValue(label.trim());

    if (!value) {
      throw new Error(await jobsError("locationNameRequired"));
    }

    const existing = await prisma.location.findFirst({
      where: { value, createdBy: user.id },
    });
    if (existing) {
      return { data: existing, success: true };
    }

    const location = await prisma.location.create({
      data: { label, value, createdBy: user.id },
    });

    return { data: location, success: true };
  } catch (error) {
    const msg = await jobsError("createLocation");
    return handleError(error, msg);
  }
};

export const createJobSource = async (
  label: string,
): Promise<any | undefined> => {
  try {
    const user = await requireUser();

    const value = canonicalizeEntityValue(label.trim());

    if (!value) {
      throw new Error(await jobsError("sourceNameRequired"));
    }

    const existing = await prisma.jobSource.findFirst({
      where: { value, createdBy: user.id },
    });
    if (existing) {
      return { data: existing, success: true };
    }

    const jobSource = await prisma.jobSource.create({
      data: { label, value, createdBy: user.id },
    });

    return { data: jobSource, success: true };
  } catch (error) {
    const msg = await jobsError("createSource");
    return handleError(error, msg);
  }
};
