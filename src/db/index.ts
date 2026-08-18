import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config";
import { categorize, type PackageRow } from "./packageCategory";

export { categorize, type PackageRow, type PackageCategory } from "./packageCategory";

export interface TrackingDetails {
  status: string;
  lastEventDescription: string;
  lastEventAt: string;
  events: unknown[];
  estimatedDelivery: string | null;
  packageType: string | null;
}

// Migracao leve pra bancos criados antes dessas colunas existirem.
const COLUMN_MIGRATIONS: Record<string, string> = {
  events_json: `ALTER TABLE packages ADD COLUMN events_json TEXT`,
  estimated_delivery: `ALTER TABLE packages ADD COLUMN estimated_delivery TEXT`,
  package_type: `ALTER TABLE packages ADD COLUMN package_type TEXT`,
};

/** Acesso a tabela `packages`: cria o schema, migra colunas novas e expoe as operacoes de leitura/escrita via metodos, num unico ponto de acesso. */
class PackageRepository {
  private readonly db: Database.Database;
  private readonly insertStmt: Database.Statement;
  private readonly updateTrackingStmt: Database.Statement;
  private readonly markDeliveredStmt: Database.Statement;
  private readonly listActiveStmt: Database.Statement;
  private readonly listAllStmt: Database.Statement;
  private readonly getByCodeStmt: Database.Statement;
  private readonly removeStmt: Database.Statement;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    this.criarSchema();
    this.aplicarMigracoesDeColuna();

    this.insertStmt = this.db.prepare(
      `INSERT OR IGNORE INTO packages (code, first_seen_at, active) VALUES (?, ?, 1)`
    );
    this.updateTrackingStmt = this.db.prepare(`
      UPDATE packages
      SET status = ?, last_event_description = ?, last_event_at = ?,
          events_json = ?, estimated_delivery = ?, package_type = ?
      WHERE code = ?
    `);
    this.markDeliveredStmt = this.db.prepare(`
      UPDATE packages
      SET delivered_at = ?, active = 0
      WHERE code = ?
    `);
    this.listActiveStmt = this.db.prepare(
      `SELECT * FROM packages WHERE active = 1 ORDER BY first_seen_at ASC`
    );
    this.listAllStmt = this.db.prepare(`SELECT * FROM packages ORDER BY first_seen_at DESC`);
    this.getByCodeStmt = this.db.prepare(`SELECT * FROM packages WHERE code = ?`);
    this.removeStmt = this.db.prepare(`DELETE FROM packages WHERE code = ?`);
  }

  private criarSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS packages (
        code TEXT PRIMARY KEY,
        first_seen_at TEXT NOT NULL,
        status TEXT,
        last_event_description TEXT,
        last_event_at TEXT,
        delivered_at TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        events_json TEXT,
        estimated_delivery TEXT,
        package_type TEXT
      );
    `);
  }

  private aplicarMigracoesDeColuna(): void {
    const existingColumns = new Set(
      (this.db.prepare(`PRAGMA table_info(packages)`).all() as { name: string }[]).map(
        (c) => c.name
      )
    );
    for (const [column, ddl] of Object.entries(COLUMN_MIGRATIONS)) {
      if (!existingColumns.has(column)) this.db.exec(ddl);
    }
  }

  /** Insere um codigo novo se ainda nao existir. Retorna true se foi de fato inserido (codigo inedito). */
  upsertCode(code: string): boolean {
    const result = this.insertStmt.run(code, new Date().toISOString());
    return result.changes > 0;
  }

  updateTracking(code: string, details: TrackingDetails): void {
    this.updateTrackingStmt.run(
      details.status,
      details.lastEventDescription,
      details.lastEventAt,
      JSON.stringify(details.events),
      details.estimatedDelivery,
      details.packageType,
      code
    );
  }

  markDelivered(code: string): void {
    this.markDeliveredStmt.run(new Date().toISOString(), code);
  }

  listActive(): PackageRow[] {
    return this.listActiveStmt.all() as PackageRow[];
  }

  listAll(): PackageRow[] {
    return this.listAllStmt.all() as PackageRow[];
  }

  getByCode(code: string): PackageRow | undefined {
    return this.getByCodeStmt.get(code) as PackageRow | undefined;
  }

  /** Remove o registro do pacote, se ele existir. O código volta a ser capturável caso apareça de novo no grupo. */
  remove(code: string): void {
    this.removeStmt.run(code);
  }

  /** Todos os pacotes prontos pro painel: categoria calculada e historico desserializado. */
  listAllForDisplay() {
    return this.listAll().map((pkg) => {
      const { events_json, ...rest } = pkg;
      return {
        ...rest,
        category: categorize(pkg),
        events: events_json ? JSON.parse(events_json) : [],
      };
    });
  }
}

export const packageRepository = new PackageRepository(config.dbPath);
