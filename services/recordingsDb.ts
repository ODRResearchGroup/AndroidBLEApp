import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DB_NAME = 'recordings.db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecordingRow = {
  recordingId: string;
  audioPath: string;
  bundlePath: string;
  createdAt: number;
  status: string;
  processedPrefix?: string | null;
  transcriptJson?: string | null;
  // Annotation fields (populated after tags are suggested / edited)
  selectedTagsJson?: string | null;   // JSON.stringify(string[])
  suggestedTagsJson?: string | null;  // JSON.stringify(string[])
  annotationIndex?: number | null;
  photoUri?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  timestamp?: string | null;
  description?: string | null;
  type?: 'audio' | 'photo' | null;
};

// ─── DB singleton ─────────────────────────────────────────────────────────────

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) {return dbPromise;}

  dbPromise = (async () => {
    const db = await SQLite.openDatabase({ name: DB_NAME, location: 'default' });

    // Base table
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS recordings (
        recordingId   TEXT PRIMARY KEY,
        audioPath     TEXT NOT NULL,
        bundlePath    TEXT NOT NULL,
        createdAt     INTEGER NOT NULL,
        status        TEXT NOT NULL,
        processedPrefix TEXT
      );
    `);

    // Safe migrations — each ALTER TABLE is silently ignored if the column exists
    const migrations = [
      'ALTER TABLE recordings ADD COLUMN transcriptJson TEXT;',
      'ALTER TABLE recordings ADD COLUMN selectedTagsJson TEXT;',
      'ALTER TABLE recordings ADD COLUMN suggestedTagsJson TEXT;',
      'ALTER TABLE recordings ADD COLUMN annotationIndex INTEGER;',
      'ALTER TABLE recordings ADD COLUMN photoUri TEXT;',
      'ALTER TABLE recordings ADD COLUMN latitude TEXT;',
      'ALTER TABLE recordings ADD COLUMN longitude TEXT;',
      'ALTER TABLE recordings ADD COLUMN timestamp TEXT;',
      'ALTER TABLE recordings ADD COLUMN description TEXT;',
      'ALTER TABLE recordings ADD COLUMN type TEXT;',
    ];

    for (const sql of migrations) {
      await db.executeSql(sql).catch(() => {});
    }

    return db;
  })();

  return dbPromise;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapRow(item: any): RecordingRow {
  return item as RecordingRow;
}

// ─── Write operations ─────────────────────────────────────────────────────────

export async function insertRecording(row: {
  recordingId: string;
  audioPath: string;
  bundlePath: string;
  createdAt: number;
  status: string;
  processedPrefix?: string | null;
  annotationIndex?: number | null;
  type?: 'audio' | 'photo' | null;
  timestamp?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  photoUri?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.executeSql(
    `INSERT OR REPLACE INTO recordings (
      recordingId, audioPath, bundlePath, createdAt, status,
      processedPrefix, annotationIndex, type, timestamp,
      latitude, longitude, photoUri,
      transcriptJson,
      selectedTagsJson, suggestedTagsJson
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      COALESCE((SELECT transcriptJson FROM recordings WHERE recordingId = ?), NULL),
      COALESCE((SELECT selectedTagsJson FROM recordings WHERE recordingId = ?), NULL),
      COALESCE((SELECT suggestedTagsJson FROM recordings WHERE recordingId = ?), NULL)
    );`,
    [
      row.recordingId, row.audioPath, row.bundlePath, row.createdAt, row.status,
      row.processedPrefix ?? null, row.annotationIndex ?? null, row.type ?? null,
      row.timestamp ?? null, row.latitude ?? null, row.longitude ?? null, row.photoUri ?? null,
      row.recordingId, row.recordingId, row.recordingId,
    ]
  );
}

export async function updateRecordingStatus(recordingId: string, status: string): Promise<void> {
  const db = await getDb();
  await db.executeSql(
    'UPDATE recordings SET status = ? WHERE recordingId = ?;',
    [status, recordingId]
  );
}

export async function updateRecordingTranscript(
  recordingId: string,
  transcriptJson: string
): Promise<void> {
  const db = await getDb();
  await db.executeSql(
    'UPDATE recordings SET transcriptJson = ? WHERE recordingId = ?;',
    [transcriptJson, recordingId]
  );
}

export async function updateRecordingTags(
  recordingId: string,
  selectedTags: string[],
  suggestedTags: string[]
): Promise<void> {
  const db = await getDb();
  await db.executeSql(
    'UPDATE recordings SET selectedTagsJson = ?, suggestedTagsJson = ? WHERE recordingId = ?;',
    [JSON.stringify(selectedTags), JSON.stringify(suggestedTags), recordingId]
  );
}

export async function updateRecordingDescription(
  recordingId: string,
  description: string
): Promise<void> {
  const db = await getDb();
  await db.executeSql(
    'UPDATE recordings SET description = ? WHERE recordingId = ?;',
    [description, recordingId]
  );
}

export async function updateRecordingAnnotation(
  recordingId: string,
  fields: {
    description?: string;
    selectedTagsJson?: string;
    suggestedTagsJson?: string;
    timestamp?: string;
    latitude?: string;
    longitude?: string;
    photoUri?: string;
  }
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];

  if (fields.description !== undefined) { sets.push('description = ?'); vals.push(fields.description); }
  if (fields.selectedTagsJson !== undefined) { sets.push('selectedTagsJson = ?'); vals.push(fields.selectedTagsJson); }
  if (fields.suggestedTagsJson !== undefined) { sets.push('suggestedTagsJson = ?'); vals.push(fields.suggestedTagsJson); }
  if (fields.timestamp !== undefined) { sets.push('timestamp = ?'); vals.push(fields.timestamp); }
  if (fields.latitude !== undefined) { sets.push('latitude = ?'); vals.push(fields.latitude); }
  if (fields.longitude !== undefined) { sets.push('longitude = ?'); vals.push(fields.longitude); }
  if (fields.photoUri !== undefined) { sets.push('photoUri = ?'); vals.push(fields.photoUri); }

  if (sets.length === 0) {return;}
  vals.push(recordingId);

  await db.executeSql(
    `UPDATE recordings SET ${sets.join(', ')} WHERE recordingId = ?;`,
    vals
  );
}

// ─── Read operations ──────────────────────────────────────────────────────────

export async function listRecordings(limit = 50): Promise<RecordingRow[]> {
  const db = await getDb();
  const [res] = await db.executeSql(
    'SELECT * FROM recordings ORDER BY createdAt DESC LIMIT ?;',
    [limit]
  );
  const rows: RecordingRow[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    rows.push(mapRow(res.rows.item(i)));
  }
  return rows;
}

export async function getRecording(recordingId: string): Promise<RecordingRow | null> {
  const db = await getDb();
  const [res] = await db.executeSql(
    'SELECT * FROM recordings WHERE recordingId = ? LIMIT 1;',
    [recordingId]
  );
  if (res.rows.length === 0) {return null;}
  return mapRow(res.rows.item(0));
}

export async function countRecordings(): Promise<number> {
  const db = await getDb();
  const [res] = await db.executeSql('SELECT COUNT(*) as cnt FROM recordings;', []);
  return res.rows.item(0).cnt as number;
}
