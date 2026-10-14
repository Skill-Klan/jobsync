-- SkillKlan cabinet login (J3): the person behind a cabinet one-time code.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "cabinetUserId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "User_cabinetUserId_key" ON "User"("cabinetUserId");
