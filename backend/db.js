import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeTables();
  }
});

function initializeTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS game_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player1_name TEXT NOT NULL,
      player2_name TEXT NOT NULL,
      player1_time INTEGER,
      player2_time INTEGER,
      winner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function saveGameResult(player1Name, player2Name, player1Time, player2Time, winner) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO game_results (player1_name, player2_name, player1_time, player2_time, winner)
       VALUES (?, ?, ?, ?, ?)`,
      [player1Name, player2Name, player1Time, player2Time, winner],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

export function getRecentResults(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM game_results ORDER BY created_at DESC LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

export default db;