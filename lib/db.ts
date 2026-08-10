import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface SpeedHistoryRecord {
  id?: number;
  createdAt: string;
  downloadMbps: number | null;
  uploadMbps: number | null;
  latencyMs: number | null;
  jitterMs: number | null;
  source: "manual" | "scheduled";
}

export interface SpeedStats {
  totalTests: number;
  avgDownload: number | null;
  avgUpload: number | null;
  bestLatency: number | null;
  worstLatency: number | null;
}

function getDbDir(): string {
  const baseDir = process.env.APPDATA || path.join(os.homedir(), ".config");
  const appDir = path.join(baseDir, "wifi-tuner");
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }
  return appDir;
}

function getJsonDbPath(): string {
  return path.join(getDbDir(), "history.json");
}

function getSettingsJsonPath(): string {
  return path.join(getDbDir(), "settings.json");
}

let sqliteDb: any = null;
let useSqlite = false;

// Attempt to initialize node:sqlite
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite");
  const dbPath = path.join(getDbDir(), "wifi-tuner.db");
  sqliteDb = new DatabaseSync(dbPath);

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS speed_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      download_mbps REAL,
      upload_mbps REAL,
      latency_ms REAL,
      jitter_ms REAL,
      source TEXT DEFAULT 'manual'
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  useSqlite = true;
} catch (e) {
  useSqlite = false;
}

// Fallback JSON helpers
function readJsonHistory(): SpeedHistoryRecord[] {
  try {
    const file = getJsonDbPath();
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return [];
  }
}

function saveJsonHistory(records: SpeedHistoryRecord[]) {
  try {
    fs.writeFileSync(getJsonDbPath(), JSON.stringify(records, null, 2), "utf-8");
  } catch (e) {
    console.error("Lỗi ghi lịch sử JSON:", e);
  }
}

function readJsonSettings(): Record<string, string> {
  try {
    const file = getSettingsJsonPath();
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

function saveJsonSettings(settings: Record<string, string>) {
  try {
    fs.writeFileSync(getSettingsJsonPath(), JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.error("Lỗi ghi cài đặt JSON:", e);
  }
}

// Exported DB operations
export function insertSpeedRecord(record: Omit<SpeedHistoryRecord, "id">): SpeedHistoryRecord {
  const createdAt = record.createdAt || new Date().toISOString();
  if (useSqlite && sqliteDb) {
    const stmt = sqliteDb.prepare(`
      INSERT INTO speed_history (created_at, download_mbps, upload_mbps, latency_ms, jitter_ms, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      createdAt,
      record.downloadMbps,
      record.uploadMbps,
      record.latencyMs,
      record.jitterMs,
      record.source || "manual"
    );
    return { id: Number(result.lastInsertRowid), ...record, createdAt };
  } else {
    const records = readJsonHistory();
    const newRecord: SpeedHistoryRecord = { id: Date.now(), ...record, createdAt };
    records.push(newRecord);
    saveJsonHistory(records);
    return newRecord;
  }
}

export function getSpeedHistory(limit = 100): SpeedHistoryRecord[] {
  if (useSqlite && sqliteDb) {
    const stmt = sqliteDb.prepare(`
      SELECT id, created_at as createdAt, download_mbps as downloadMbps, upload_mbps as uploadMbps, latency_ms as latencyMs, jitter_ms as jitterMs, source
      FROM speed_history
      ORDER BY id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as SpeedHistoryRecord[];
  } else {
    const records = readJsonHistory();
    return [...records].reverse().slice(0, limit);
  }
}

export function getSpeedStats(): SpeedStats {
  const records = getSpeedHistory(500);
  if (records.length === 0) {
    return {
      totalTests: 0,
      avgDownload: null,
      avgUpload: null,
      bestLatency: null,
      worstLatency: null,
    };
  }

  const downloads = records.map((r) => r.downloadMbps).filter((v): v is number => v !== null);
  const uploads = records.map((r) => r.uploadMbps).filter((v): v is number => v !== null);
  const latencies = records.map((r) => r.latencyMs).filter((v): v is number => v !== null);

  const avg = (arr: number[]) => (arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

  return {
    totalTests: records.length,
    avgDownload: avg(downloads),
    avgUpload: avg(uploads),
    bestLatency: latencies.length > 0 ? Math.min(...latencies) : null,
    worstLatency: latencies.length > 0 ? Math.max(...latencies) : null,
  };
}

export function clearSpeedHistory(): void {
  if (useSqlite && sqliteDb) {
    sqliteDb.exec("DELETE FROM speed_history;");
  } else {
    saveJsonHistory([]);
  }
}

export function getAppSetting(key: string, defaultValue = ""): string {
  if (useSqlite && sqliteDb) {
    const stmt = sqliteDb.prepare("SELECT value FROM app_settings WHERE key = ?");
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  } else {
    const settings = readJsonSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }
}

export function setAppSetting(key: string, value: string): void {
  if (useSqlite && sqliteDb) {
    const stmt = sqliteDb.prepare(`
      INSERT INTO app_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, value);
  } else {
    const settings = readJsonSettings();
    settings[key] = value;
    saveJsonSettings(settings);
  }
}
