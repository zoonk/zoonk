-- CreateTable
CREATE TABLE "restore_keys" (
    "id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "session_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restore_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restore_keys_session_id_key" ON "restore_keys"("session_id");

-- AddForeignKey
ALTER TABLE "restore_keys" ADD CONSTRAINT "restore_keys_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
