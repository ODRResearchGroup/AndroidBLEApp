import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DB_NAME = 'recordings.db';

export type RecordingRow = {
  recordingId: string;
  audioPath: string;
  bundlePath: string;
  createdAt: number;
  status: string;
  processedPrefix?: string | null;
  transcriptJson?: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    const db = await SQLite.openDatabase({ name: DB_NAME, location: 'default' });

    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS recordings (
        recordingId TEXT PRIMARY KEY,
        audioPath TEXT NOT NULL,
        bundlePath TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        status TEXT NOT NULL,
        processedPrefix TEXT
      );
    `);

    // Migration-safe: add new columns if missing
    await db.executeSql('ALTER TABLE recordings ADD COLUMN transcriptJson TEXT;').catch(() => {});

    return db;
  })();

  return dbPromise;
}

export async function insertRecording(row: {
  recordingId: string;
  audioPath: string;
  bundlePath: string;
  createdAt: number;
  status: string;
  processedPrefix?: string | null;
}) {
  const db = await getDb();

  await db.executeSql(
    `
    INSERT OR REPLACE INTO recordings (
      recordingId, audioPath, bundlePath, createdAt, status, processedPrefix, transcriptJson
    ) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT transcriptJson FROM recordings WHERE recordingId = ?), NULL));
    `,
    [
      row.recordingId,
      row.audioPath,
      row.bundlePath,
      row.createdAt,
      row.status,
      row.processedPrefix ?? null,
      row.recordingId,
    ]
  );
}

export async function updateRecordingStatus(recordingId: string, status: string) {
  const db = await getDb();
  await db.executeSql('UPDATE recordings SET status = ? WHERE recordingId = ?;', [
    status,
    recordingId,
  ]);
}

export async function updateRecordingProcessedPrefix(recordingId: string, processedPrefix: string) {
  const db = await getDb();
  await db.executeSql('UPDATE recordings SET processedPrefix = ? WHERE recordingId = ?;', [
    processedPrefix,
    recordingId,
  ]);
}

export async function updateRecordingTranscript(recordingId: string, transcriptJson: string) {
  const db = await getDb();
  await db.executeSql('UPDATE recordings SET transcriptJson = ? WHERE recordingId = ?;', [
    transcriptJson,
    recordingId,
  ]);
}

export async function listRecordings(limit = 50): Promise<RecordingRow[]> {
  const db = await getDb();

  const [res] = await db.executeSql(
    `
    SELECT recordingId, audioPath, bundlePath, createdAt, status, processedPrefix, transcriptJson
    FROM recordings
    ORDER BY createdAt DESC
    LIMIT ?;
    `,
    [limit]
  );

  const rows: RecordingRow[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    rows.push(res.rows.item(i) as RecordingRow);
  }
  return rows;
}

export async function getRecording(recordingId: string): Promise<RecordingRow | null> {
  const db = await getDb();

  const [res] = await db.executeSql(
    `
    SELECT recordingId, audioPath, bundlePath, createdAt, status, processedPrefix, transcriptJson
    FROM recordings
    WHERE recordingId = ?
    LIMIT 1;
    `,
    [recordingId]
  );

  if (res.rows.length === 0) {
    return null;
  }

  return res.rows.item(0) as RecordingRow;
}
