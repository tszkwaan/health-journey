-- AlterTable
ALTER TABLE "public"."MedicalBackground" ADD COLUMN     "enhancedSummary" JSONB,
ADD COLUMN     "llmSummary" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "voiceAIConsent" BOOLEAN NOT NULL DEFAULT false;
