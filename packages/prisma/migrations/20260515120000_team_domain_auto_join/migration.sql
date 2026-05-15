-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "domainAutoJoinEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "domainAutoJoinDomain" TEXT;
