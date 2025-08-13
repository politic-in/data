#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const Database = require('better-sqlite3');

// SQL schemas for different data types
const SCHEMAS = {
  booth: `
    CREATE TABLE IF NOT EXISTS booth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      state_cd VARCHAR(10) NOT NULL,
      district_cd VARCHAR(10) NOT NULL,
      ac_number INTEGER NOT NULL,
      part_number INTEGER NOT NULL,
      part_name TEXT NOT NULL,
      ac_name VARCHAR(255) NOT NULL,
      district_code VARCHAR(10) NOT NULL,
      district_name VARCHAR(255) NOT NULL,
      state_code VARCHAR(10) NOT NULL,
      state_name VARCHAR(255) NOT NULL,
      UNIQUE(part_id)
    );
    CREATE INDEX idx_booth_state ON booth(state_name);
    CREATE INDEX idx_booth_district ON booth(district_name);
    CREATE INDEX idx_booth_ac ON booth(ac_name);
  `,
  
  census: `
    CREATE TABLE IF NOT EXISTS census (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      district_name VARCHAR(255) NOT NULL,
      state_name VARCHAR(255) NOT NULL,
      population_total INTEGER,
      population_male INTEGER,
      population_female INTEGER,
      population_sex_ratio INTEGER,
      child_population_total INTEGER,
      child_population_male INTEGER,
      child_population_female INTEGER,
      child_population_sex_ratio INTEGER,
      child_population_percentage REAL,
      literacy_total INTEGER,
      literacy_male INTEGER,
      literacy_female INTEGER,
      literacy_rate REAL,
      literacy_male_rate REAL,
      literacy_female_rate REAL,
      UNIQUE(district_name, state_name)
    );
    CREATE INDEX idx_census_state ON census(state_name);
    CREATE INDEX idx_census_district ON census(district_name);
  `,
  
  election_mla: `
    CREATE TABLE IF NOT EXISTS election_mla (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state VARCHAR(255) NOT NULL,
      constituency VARCHAR(255) NOT NULL,
      district VARCHAR(255),
      ac_type VARCHAR(10),
      year INTEGER NOT NULL,
      poll_date DATE,
      counting_date DATE,
      total_contestants INTEGER,
      total_electors INTEGER,
      total_votes_polled INTEGER,
      turnout_percentage REAL,
      margin_votes INTEGER,
      margin_percentage REAL
    );
    
    CREATE TABLE IF NOT EXISTS election_mla_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      party VARCHAR(255) NOT NULL,
      votes INTEGER NOT NULL,
      votes_percentage REAL NOT NULL,
      FOREIGN KEY (election_id) REFERENCES election_mla(id)
    );
    
    CREATE INDEX idx_mla_state ON election_mla(state);
    CREATE INDEX idx_mla_constituency ON election_mla(constituency);
    CREATE INDEX idx_mla_year ON election_mla(year);
    CREATE INDEX idx_mla_candidates_election ON election_mla_candidates(election_id);
  `,
  
  election_mp: `
    CREATE TABLE IF NOT EXISTS election_mp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state VARCHAR(255) NOT NULL,
      constituency VARCHAR(255) NOT NULL,
      district VARCHAR(255),
      ac_type VARCHAR(10),
      year INTEGER NOT NULL,
      poll_date DATE,
      counting_date DATE,
      total_contestants INTEGER,
      total_electors INTEGER,
      total_votes_polled INTEGER,
      turnout_percentage REAL,
      margin_votes INTEGER,
      margin_percentage REAL
    );
    
    CREATE TABLE IF NOT EXISTS election_mp_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      election_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      party VARCHAR(255) NOT NULL,
      votes INTEGER NOT NULL,
      votes_percentage REAL NOT NULL,
      FOREIGN KEY (election_id) REFERENCES election_mp(id)
    );
    
    CREATE INDEX idx_mp_state ON election_mp(state);
    CREATE INDEX idx_mp_constituency ON election_mp(constituency);
    CREATE INDEX idx_mp_year ON election_mp(year);
    CREATE INDEX idx_mp_candidates_election ON election_mp_candidates(election_id);
  `
};

async function loadBoothData(db, files) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO booth (
      part_id, state_cd, district_cd, ac_number, part_number,
      part_name, ac_name, district_code, district_name,
      state_code, state_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(content);
      
      for (const item of data) {
        stmt.run(
          item.partId, item.stateCd, item.districtCd, item.acNumber,
          item.partNumber, item.partName, item.acName, item.districtCode,
          item.districtName, item.stateCode, item.stateName
        );
        count++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  return count;
}

async function loadCensusData(db, files) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO census (
      district_name, state_name, population_total, population_male,
      population_female, population_sex_ratio, child_population_total,
      child_population_male, child_population_female, child_population_sex_ratio,
      child_population_percentage, literacy_total, literacy_male,
      literacy_female, literacy_rate, literacy_male_rate, literacy_female_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(content);
      
      // Extract district and state from file path
      const pathParts = file.split(path.sep);
      const filename = path.basename(file, '.json');
      const state = pathParts[pathParts.length - 2];
      const district = filename.replace(/-/g, ' ');
      
      stmt.run(
        district, state,
        data.population?.total || null,
        data.population?.male || null,
        data.population?.female || null,
        data.population?.sex_ratio || null,
        data.child_population?.total || null,
        data.child_population?.male || null,
        data.child_population?.female || null,
        data.child_population?.sex_ratio || null,
        data.child_population?.percentage_of_total_population || null,
        data.literacy?.total_literate || null,
        data.literacy?.male_literate || null,
        data.literacy?.female_literate || null,
        data.literacy?.rate_percentage || null,
        data.literacy?.male_literacy_rate || null,
        data.literacy?.female_literacy_rate || null
      );
      count++;
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  return count;
}

async function loadElectionData(db, files, type) {
  const table = type === 'mla' ? 'election_mla' : 'election_mp';
  const candidateTable = type === 'mla' ? 'election_mla_candidates' : 'election_mp_candidates';
  
  const electionStmt = db.prepare(`
    INSERT INTO ${table} (
      state, constituency, district, ac_type, year,
      poll_date, counting_date, total_contestants,
      total_electors, total_votes_polled, turnout_percentage,
      margin_votes, margin_percentage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const candidateStmt = db.prepare(`
    INSERT INTO ${candidateTable} (
      election_id, position, name, party, votes, votes_percentage
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(content);
      
      for (const [year, result] of Object.entries(data.results || {})) {
        const electionInfo = electionStmt.run(
          data.state, data.constituency, data.district || null,
          data.ac_type || null, parseInt(year),
          result.poll_date || null, result.counting_date || null,
          result.total_contestants || null,
          result.aggregate?.total_electors || null,
          result.aggregate?.total_votes_polled || null,
          result.aggregate?.turnout_percentage || null,
          result.aggregate?.margin_votes || null,
          result.aggregate?.margin_percentage || null
        );
        
        if (result.candidates) {
          for (const candidate of result.candidates) {
            candidateStmt.run(
              electionInfo.lastInsertRowid,
              candidate.position, candidate.name, candidate.party,
              candidate.votes, candidate.votes_percentage
            );
          }
        }
        count++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  return count;
}

async function createSQLiteDatabase(outputPath) {
  console.log('Creating SQLite database...');
  const db = new Database(outputPath);
  
  // Create tables
  for (const [type, schema] of Object.entries(SCHEMAS)) {
    console.log(`Creating ${type} tables...`);
    db.exec(schema);
  }
  
  // Load data
  db.prepare('BEGIN TRANSACTION').run();
  
  try {
    // Booth data
    const boothFiles = await glob('booth/**/*.json');
    const boothCount = await loadBoothData(db, boothFiles);
    console.log(`Loaded ${boothCount} booth records`);
    
    // Census data
    const censusFiles = await glob('census/**/*.json');
    const censusCount = await loadCensusData(db, censusFiles);
    console.log(`Loaded ${censusCount} census records`);
    
    // Election MLA data
    const mlaFiles = await glob('election-mla/**/*.json');
    const mlaCount = await loadElectionData(db, mlaFiles, 'mla');
    console.log(`Loaded ${mlaCount} MLA election records`);
    
    // Election MP data
    const mpFiles = await glob('election-mp/**/*.json');
    const mpCount = await loadElectionData(db, mpFiles, 'mp');
    console.log(`Loaded ${mpCount} MP election records`);
    
    db.prepare('COMMIT').run();
  } catch (error) {
    db.prepare('ROLLBACK').run();
    throw error;
  }
  
  // Add metadata table
  db.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    INSERT INTO metadata VALUES 
      ('version', '${new Date().toISOString().split('T')[0]}'),
      ('source', 'https://github.com/politic-in/data'),
      ('license', 'CC0 1.0 Universal');
  `);
  
  db.close();
  console.log(`SQLite database created: ${outputPath}`);
}

async function generatePostgreSQLDump(sqlitePath, outputPath) {
  console.log('Generating PostgreSQL dump...');
  const db = new Database(sqlitePath, { readonly: true });
  
  let dump = `-- PostgreSQL dump for Indian Political Data
-- Generated on ${new Date().toISOString()}
-- Source: https://github.com/politic-in/data

BEGIN;

`;
  
  // Convert SQLite schema to PostgreSQL
  for (const [type, schema] of Object.entries(SCHEMAS)) {
    // Convert SQLite syntax to PostgreSQL
    let pgSchema = schema
      .replace(/AUTOINCREMENT/g, '')
      .replace(/INTEGER PRIMARY KEY/g, 'SERIAL PRIMARY KEY')
      .replace(/REAL/g, 'DECIMAL(10,2)')
      .replace(/TEXT/g, 'TEXT');
    
    dump += pgSchema + '\n\n';
  }
  
  // Export booth data
  const boothRows = db.prepare('SELECT * FROM booth').all();
  for (const row of boothRows) {
    dump += `INSERT INTO booth (part_id, state_cd, district_cd, ac_number, part_number, part_name, ac_name, district_code, district_name, state_code, state_name) VALUES (${row.part_id}, '${row.state_cd}', '${row.district_cd}', ${row.ac_number}, ${row.part_number}, '${row.part_name.replace(/'/g, "''")}', '${row.ac_name.replace(/'/g, "''")}', '${row.district_code}', '${row.district_name.replace(/'/g, "''")}', '${row.state_code}', '${row.state_name.replace(/'/g, "''")}');\n`;
  }
  
  dump += '\nCOMMIT;\n';
  
  fs.writeFileSync(outputPath, dump);
  db.close();
  console.log(`PostgreSQL dump created: ${outputPath}`);
}

async function main() {
  const outputDir = 'dist';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  const sqlitePath = path.join(outputDir, 'politic-data.db');
  const pgDumpPath = path.join(outputDir, 'politic-data.sql');
  
  try {
    await createSQLiteDatabase(sqlitePath);
    await generatePostgreSQLDump(sqlitePath, pgDumpPath);
    
    console.log('\n✅ Database generation complete!');
    console.log(`SQLite: ${sqlitePath}`);
    console.log(`PostgreSQL: ${pgDumpPath}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createSQLiteDatabase, generatePostgreSQLDump };