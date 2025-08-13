#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const parquet = require('parquetjs');

// Parquet schemas
const boothSchema = new parquet.ParquetSchema({
  part_id: { type: 'INT32' },
  state_cd: { type: 'UTF8' },
  district_cd: { type: 'UTF8' },
  ac_number: { type: 'INT32' },
  part_number: { type: 'INT32' },
  part_name: { type: 'UTF8' },
  ac_name: { type: 'UTF8' },
  district_code: { type: 'UTF8' },
  district_name: { type: 'UTF8' },
  state_code: { type: 'UTF8' },
  state_name: { type: 'UTF8' }
});

const censusSchema = new parquet.ParquetSchema({
  district_name: { type: 'UTF8' },
  state_name: { type: 'UTF8' },
  population_total: { type: 'INT32', optional: true },
  population_male: { type: 'INT32', optional: true },
  population_female: { type: 'INT32', optional: true },
  population_sex_ratio: { type: 'INT32', optional: true },
  child_population_total: { type: 'INT32', optional: true },
  child_population_male: { type: 'INT32', optional: true },
  child_population_female: { type: 'INT32', optional: true },
  child_population_sex_ratio: { type: 'INT32', optional: true },
  child_population_percentage: { type: 'FLOAT', optional: true },
  literacy_total: { type: 'INT32', optional: true },
  literacy_male: { type: 'INT32', optional: true },
  literacy_female: { type: 'INT32', optional: true },
  literacy_rate: { type: 'FLOAT', optional: true },
  literacy_male_rate: { type: 'FLOAT', optional: true },
  literacy_female_rate: { type: 'FLOAT', optional: true }
});

const electionSchema = new parquet.ParquetSchema({
  state: { type: 'UTF8' },
  constituency: { type: 'UTF8' },
  district: { type: 'UTF8', optional: true },
  ac_type: { type: 'UTF8', optional: true },
  year: { type: 'INT32' },
  poll_date: { type: 'UTF8', optional: true },
  counting_date: { type: 'UTF8', optional: true },
  total_contestants: { type: 'INT32', optional: true },
  total_electors: { type: 'INT32', optional: true },
  total_votes_polled: { type: 'INT32', optional: true },
  turnout_percentage: { type: 'FLOAT', optional: true },
  margin_votes: { type: 'INT32', optional: true },
  margin_percentage: { type: 'FLOAT', optional: true },
  winner_name: { type: 'UTF8', optional: true },
  winner_party: { type: 'UTF8', optional: true },
  winner_votes: { type: 'INT32', optional: true },
  runner_up_name: { type: 'UTF8', optional: true },
  runner_up_party: { type: 'UTF8', optional: true },
  runner_up_votes: { type: 'INT32', optional: true }
});

async function createBoothParquet(outputPath) {
  console.log('Creating booth Parquet file...');
  const writer = await parquet.ParquetWriter.openFile(boothSchema, outputPath);
  
  const files = await glob('booth/**/*.json');
  let count = 0;
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(content);
      
      for (const item of data) {
        await writer.appendRow({
          part_id: item.partId,
          state_cd: item.stateCd,
          district_cd: item.districtCd,
          ac_number: item.acNumber,
          part_number: item.partNumber,
          part_name: item.partName,
          ac_name: item.acName,
          district_code: item.districtCode,
          district_name: item.districtName,
          state_code: item.stateCode,
          state_name: item.stateName
        });
        count++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  
  await writer.close();
  console.log(`Created booth.parquet with ${count} records`);
}

async function createCensusParquet(outputPath) {
  console.log('Creating census Parquet file...');
  const writer = await parquet.ParquetWriter.openFile(censusSchema, outputPath);
  
  const files = await glob('census/**/*.json');
  let count = 0;
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(content);
      
      const pathParts = file.split(path.sep);
      const filename = path.basename(file, '.json');
      const state = pathParts[pathParts.length - 2];
      const district = filename.replace(/-/g, ' ');
      
      await writer.appendRow({
        district_name: district,
        state_name: state,
        population_total: data.population?.total || null,
        population_male: data.population?.male || null,
        population_female: data.population?.female || null,
        population_sex_ratio: data.population?.sex_ratio || null,
        child_population_total: data.child_population?.total || null,
        child_population_male: data.child_population?.male || null,
        child_population_female: data.child_population?.female || null,
        child_population_sex_ratio: data.child_population?.sex_ratio || null,
        child_population_percentage: data.child_population?.percentage_of_total_population || null,
        literacy_total: data.literacy?.total_literate || null,
        literacy_male: data.literacy?.male_literate || null,
        literacy_female: data.literacy?.female_literate || null,
        literacy_rate: data.literacy?.rate_percentage || null,
        literacy_male_rate: data.literacy?.male_literacy_rate || null,
        literacy_female_rate: data.literacy?.female_literacy_rate || null
      });
      count++;
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  
  await writer.close();
  console.log(`Created census.parquet with ${count} records`);
}

async function createElectionParquet(type, outputPath) {
  console.log(`Creating ${type} Parquet file...`);
  const writer = await parquet.ParquetWriter.openFile(electionSchema, outputPath);
  
  const files = await glob(`election-${type}/**/*.json`);
  let count = 0;
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(content);
      
      for (const [year, result] of Object.entries(data.results || {})) {
        const winner = result.candidates?.[0];
        const runnerUp = result.candidates?.[1];
        
        await writer.appendRow({
          state: data.state,
          constituency: data.constituency,
          district: data.district || null,
          ac_type: data.ac_type || null,
          year: parseInt(year),
          poll_date: result.poll_date || null,
          counting_date: result.counting_date || null,
          total_contestants: result.total_contestants || null,
          total_electors: result.aggregate?.total_electors || null,
          total_votes_polled: result.aggregate?.total_votes_polled || null,
          turnout_percentage: result.aggregate?.turnout_percentage || null,
          margin_votes: result.aggregate?.margin_votes || null,
          margin_percentage: result.aggregate?.margin_percentage || null,
          winner_name: winner?.name || null,
          winner_party: winner?.party || null,
          winner_votes: winner?.votes || null,
          runner_up_name: runnerUp?.name || null,
          runner_up_party: runnerUp?.party || null,
          runner_up_votes: runnerUp?.votes || null
        });
        count++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
  
  await writer.close();
  console.log(`Created election_${type}.parquet with ${count} records`);
}

async function main() {
  const outputDir = 'dist';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  try {
    await createBoothParquet(path.join(outputDir, 'booth.parquet'));
    await createCensusParquet(path.join(outputDir, 'census.parquet'));
    await createElectionParquet('mla', path.join(outputDir, 'election_mla.parquet'));
    await createElectionParquet('mp', path.join(outputDir, 'election_mp.parquet'));
    
    console.log('\n✅ Parquet generation complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createBoothParquet, createCensusParquet, createElectionParquet };