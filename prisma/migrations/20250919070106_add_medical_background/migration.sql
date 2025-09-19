-- CreateTable
CREATE TABLE "public"."MedicalBackground" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "patientId" TEXT NOT NULL,
    "pastMedicalConditions" JSONB,
    "otherMedicalCondition" TEXT,
    "surgicalHistory" JSONB,
    "medications" JSONB,
    "allergies" JSONB,
    "otherAllergy" TEXT,
    "familyHistory" JSONB,
    "otherFamilyHistory" TEXT,
    "smoking" JSONB,
    "alcohol" JSONB,
    "exerciseFrequency" TEXT,
    "occupation" TEXT,
    "menstrualCycle" TEXT,
    "menopause" TEXT,
    "pregnancyHistory" JSONB,
    "contraceptives" JSONB,
    "immunizations" JSONB,
    "otherImmunization" TEXT,

    CONSTRAINT "MedicalBackground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicalBackgroundVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "medicalBackgroundId" TEXT NOT NULL,

    CONSTRAINT "MedicalBackgroundVersion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."MedicalBackground" ADD CONSTRAINT "MedicalBackground_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalBackgroundVersion" ADD CONSTRAINT "MedicalBackgroundVersion_medicalBackgroundId_fkey" FOREIGN KEY ("medicalBackgroundId") REFERENCES "public"."MedicalBackground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
