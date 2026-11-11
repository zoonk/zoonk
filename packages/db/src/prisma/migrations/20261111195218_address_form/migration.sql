-- CreateEnum
CREATE TYPE "AddressForm" AS ENUM ('feminine', 'masculine', 'neutral');

-- AlterEnum
ALTER TYPE "ProfileQuestion" ADD VALUE 'address_form';

-- AlterTable
ALTER TABLE "user_learning_profiles" ADD COLUMN     "address_form" "AddressForm";
