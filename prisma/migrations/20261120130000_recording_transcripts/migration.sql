-- Transcripts of the interview recordings (owner 2026-11-20, D104–D106): one row
-- per recording of the library, shared by everyone; while it is not done, the row
-- is a job of the transcription queue. A new, empty table — no data moves.
-- CreateTable
CREATE TABLE "RecordingTranscript" (
    "recordingId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "segments" TEXT,
    "languageCode" TEXT,
    "durationSecs" REAL,
    "model" TEXT,
    "failure" TEXT,
    "requestedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    CONSTRAINT "RecordingTranscript_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecordingTranscript_status_createdAt_idx" ON "RecordingTranscript"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RecordingTranscript_requestedById_status_idx" ON "RecordingTranscript"("requestedById", "status");

