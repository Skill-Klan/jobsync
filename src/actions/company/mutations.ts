"use server";
import prisma from "@/lib/db";
import { handleError } from "@/lib/utils";
import { canonicalizeEntityValue } from "@/lib/jobs/canonicalize";
import { COMPANY_NOTES_MAX_LENGTH, COMPANY_SIZES } from "@/lib/constants";
import { AddCompanyFormSchema } from "@/models/addCompanyForm.schema";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../shared";
import { getTranslations } from "@/i18n/server";

// What a person reads is in their language; the translator is passed to
// the sync helpers below, which cannot await it themselves.
type LibraryT = Awaited<ReturnType<typeof getTranslations<"library">>>;

const isValidImageUrl = (url: string): boolean => {
  if (!url) return true;
  if (url.startsWith("/")) return true;
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Absolute http(s) only — an employer URL is never a bundled asset path.
const isValidHttpUrl = (url: string): boolean => {
  if (!url) return true;
  try {
    const urlObj = new URL(url);
    return ["http:", "https:"].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

const assertLinkedinSizeNotes = (
  t: LibraryT,
  linkedinUrl?: string,
  size?: string,
  notes?: string,
) => {
  if (linkedinUrl && !isValidHttpUrl(linkedinUrl)) {
    throw new Error(t("errors.company.linkedinUrl"));
  }
  if (size && !(COMPANY_SIZES as readonly string[]).includes(size)) {
    throw new Error(t("errors.company.invalidSize"));
  }
  if (notes && notes.length > COMPANY_NOTES_MAX_LENGTH) {
    throw new Error(
      // A string, so the number is not grouped ("5,000")
      t("errors.company.notesTooLong", { max: String(COMPANY_NOTES_MAX_LENGTH) }),
    );
  }
};

export const addCompany = async (
  data: z.infer<typeof AddCompanyFormSchema>,
): Promise<any | undefined> => {
  const t = await getTranslations("library");
  try {
    const user = await requireUser();

    const {
      company,
      logoUrl,
      websiteUrl,
      careersUrl,
      industry,
      linkedinUrl,
      size,
      notes,
    } = data;

    // Validate image URL
    if (logoUrl && !isValidImageUrl(logoUrl)) {
      throw new Error(t("errors.company.invalidLogo"));
    }

    if (websiteUrl && !isValidHttpUrl(websiteUrl)) {
      throw new Error(t("errors.company.websiteUrl"));
    }
    if (careersUrl && !isValidHttpUrl(careersUrl)) {
      throw new Error(t("errors.company.careersUrl"));
    }
    assertLinkedinSizeNotes(t, linkedinUrl, size, notes);

    const value = canonicalizeEntityValue(company.trim(), { stripLegalSuffix: true });

    const companyExists = await prisma.company.findFirst({
      where: {
        value,
        createdBy: user.id,
      },
    });

    if (companyExists) {
      throw new Error(t("errors.company.exists"));
    }

    const res = await prisma.company.create({
      data: {
        createdBy: user.id,
        value,
        label: company,
        logoUrl,
        websiteUrl,
        careersUrl,
        industry,
        linkedinUrl,
        size,
        notes,
      },
    });
    revalidatePath("/dashboard/myjobs", "page");
    return { success: true, data: res };
  } catch (error) {
    const msg = t("errors.company.createFailed");
    return handleError(error, msg);
  }
};

export const updateCompany = async (
  data: z.infer<typeof AddCompanyFormSchema>,
): Promise<any | undefined> => {
  const t = await getTranslations("library");
  try {
    const user = await requireUser();

    const {
      id,
      company,
      logoUrl,
      createdBy,
      websiteUrl,
      careersUrl,
      industry,
      linkedinUrl,
      size,
      notes,
    } = data;

    if (!id) {
      throw new Error("Company id is required");
    }

    // Validate image URL
    if (logoUrl && !isValidImageUrl(logoUrl)) {
      throw new Error(t("errors.company.invalidLogo"));
    }

    if (websiteUrl && !isValidHttpUrl(websiteUrl)) {
      throw new Error(t("errors.company.websiteUrl"));
    }
    if (careersUrl && !isValidHttpUrl(careersUrl)) {
      throw new Error(t("errors.company.careersUrl"));
    }
    assertLinkedinSizeNotes(t, linkedinUrl, size, notes);

    const existingCompany = await prisma.company.findFirst({
      where: {
        id,
        createdBy: user.id,
      },
    });

    if (!existingCompany) {
      throw new Error(t("errors.company.notFound"));
    }

    const trimmedLabel = company.trim();

    // Only recompute the match key when the label actually changed. Some
    // rows (e.g. mock-seeded companies) intentionally hold a `value` that
    // isn't derivable from their label — recomputing on every save would
    // collide with an unrelated company sharing the same canonical label.
    let value = existingCompany.value;
    if (trimmedLabel !== existingCompany.label) {
      value = canonicalizeEntityValue(trimmedLabel, { stripLegalSuffix: true });

      const companyExists = await prisma.company.findFirst({
        where: {
          value,
          createdBy: user.id,
        },
      });

      if (companyExists && companyExists.id !== id) {
        throw new Error(t("errors.company.exists"));
      }
    }

    const res = await prisma.company.update({
      where: {
        id,
        createdBy: user.id,
      },
      data: {
        value,
        label: company,
        logoUrl,
        websiteUrl,
        careersUrl,
        industry,
        linkedinUrl,
        size,
        notes,
      },
    });

    return { success: true, data: res };
  } catch (error) {
    const msg = t("errors.company.updateFailed");
    return handleError(error, msg);
  }
};

export const deleteCompanyById = async (
  companyId: string,
): Promise<any | undefined> => {
  const t = await getTranslations("library");
  try {
    const user = await requireUser();

    // WorkExperience has no userId, so ownership runs through the resume
    // chain. The null-section arm keeps unsectioned rows blocking deletion
    // rather than letting it fail later on the foreign key.
    const experiences = await prisma.workExperience.count({
      where: {
        companyId,
        OR: [
          { ResumeSection: { Resume: { profile: { userId: user.id } } } },
          { resumeSectionId: null },
        ],
      },
    });
    if (experiences > 0) {
      throw new Error(t("errors.company.inResume"));
    }
    const jobs = await prisma.job.count({
      where: {
        companyId,
        userId: user.id,
      },
    });

    if (jobs > 0) {
      throw new Error(t("errors.company.hasJobs", { count: jobs }));
    }

    // Contact.companyId and .workedAtCompanyId are optional relations, whose
    // Prisma default is SetNull — deleting would silently blank the employer
    // rather than fail. This guard is the only thing stopping it.
    const contacts = await prisma.contact.count({
      where: {
        createdBy: user.id,
        OR: [{ companyId }, { workedAtCompanyId: companyId }],
      },
    });
    if (contacts > 0) {
      throw new Error(t("errors.company.hasContacts", { count: contacts }));
    }

    const res = await prisma.company.delete({
      where: {
        id: companyId,
        createdBy: user.id,
      },
    });
    return { res, success: true };
  } catch (error) {
    const msg = t("errors.company.deleteFailed");
    return handleError(error, msg);
  }
};
