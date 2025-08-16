#!/usr/bin/env node

/**
 * Build vector embeddings using RunPod with proper field mapping
 */

const dotenv = require('dotenv');
dotenv.config();

const fs = require('fs').promises;
const Database = require('better-sqlite3');
const axios = require('axios');

class RunPodVectorBuilder {
  constructor() {
    this.endpointId = process.env.RUNPOD_ENDPOINT_ID;
    this.apiKey = process.env.RUNPOD_API_KEY;
    
    if (!this.endpointId || !this.apiKey) {
      console.error('❌ Missing RunPod credentials!');
      process.exit(1);
    }

    this.BATCH_SIZE = 100; // Optimal batch size for production
    this.PARALLEL_REQUESTS = 2; // Parallel requests for better throughput
    
    this.stats = {
      total_processed: 0,
      start_time: Date.now()
    };
  }

  async callRunPodAPI(texts) {
    try {
      const response = await axios({
        method: 'POST',
        url: `https://api.runpod.ai/v2/${this.endpointId}/runsync`,
        headers: {
          'accept': 'application/json',
          'authorization': this.apiKey,  // No "Bearer" prefix!
          'content-type': 'application/json'
        },
        data: {
          input: {
            model: "sentence-transformers/all-MiniLM-L6-v2",
            input: texts
          }
        },
        timeout: 60000
      });

      if (response.data.status === 'COMPLETED' && response.data.output) {
        // Handle OpenAI-compatible format
        if (response.data.output.data) {
          return response.data.output.data.map(item => item.embedding);
        }
        // Handle direct array format
        if (Array.isArray(response.data.output)) {
          return response.data.output;
        }
      }
      
      throw new Error(`API Error: ${JSON.stringify(response.data).substring(0, 500)}`);
    } catch (error) {
      console.error('RunPod API error:', error.message);
      throw error;
    }
  }

  createBoothText(booth) {
    // Use the actual column names from the database
    const partName = booth.part_name || booth.partName || 'Unknown booth';
    const acName = booth.ac_name || booth.acName || 'Unknown constituency';
    const districtName = booth.district_name || booth.districtName || 'Unknown district';
    const stateName = booth.state_name || booth.stateName || 'Unknown state';
    const partNumber = booth.part_number || booth.partNumber || 0;
    
    return `Polling booth ${partName} in ${acName} constituency, ${districtName} district, ${stateName}. Part number ${partNumber}`;
  }

  createCensusText(census) {
    const district = census.district || census.district_name || 'Unknown district';
    const state = census.state || census.state_name || 'Unknown state';
    const population = census.total_population || census.population || 0;
    const year = census.census_year || 2011;
    
    return `${district} district in ${state} with population ${population}. Census year ${year}`;
  }

  createElectionText(election, type) {
    const candidateName = election.candidate_name || 'Unknown candidate';
    const party = election.party || 'Unknown party';
    const constituency = election.constituency || 'Unknown constituency';
    const state = election.state || election.state_name || 'Unknown state';
    const year = election.year || 'Unknown year';
    const votes = election.votes || 0;
    
    return `${candidateName} from ${party} contested in ${constituency} ${type} constituency, ${state} in ${year} election. Received ${votes} votes`;
  }

  async processBoothData(db) {
    console.log(`\n📍 Processing ALL booth data...`);
    const booths = db.prepare('SELECT * FROM booth').all();
    console.log(`  Loaded ${booths.length} booth records`);
    
    const vectorData = [];
    
    // Process in batches
    for (let i = 0; i < booths.length; i += this.BATCH_SIZE) {
      const batch = booths.slice(i, i + this.BATCH_SIZE);
      const texts = batch.map(booth => this.createBoothText(booth));
      
      console.log(`  Processing batch ${Math.floor(i/this.BATCH_SIZE) + 1}/${Math.ceil(booths.length/this.BATCH_SIZE)}...`);
      
      try {
        const embeddings = await this.callRunPodAPI(texts);
        
        batch.forEach((booth, idx) => {
          vectorData.push({
            id: `booth_${booth.part_id || booth.id}`,
            type: 'booth',
            text: texts[idx],
            embedding: embeddings[idx],
            metadata: {
              partId: booth.part_id,
              stateName: booth.state_name,
              stateCode: booth.state_code || booth.state_cd,
              districtName: booth.district_name,
              districtCode: booth.district_code || booth.district_cd,
              acName: booth.ac_name,
              acNumber: booth.ac_number,
              partNumber: booth.part_number,
              partName: booth.part_name
            }
          });
        });
        
        this.stats.total_processed += batch.length;
        console.log(`    ✓ Processed ${batch.length} records`);
      } catch (error) {
        console.error(`    ✗ Batch failed: ${error.message}`);
      }
    }
    
    return vectorData;
  }

  async processCensusData(db) {
    console.log('\n📊 Processing census data...');
    const censusRecords = db.prepare('SELECT * FROM census').all();
    console.log(`  Loaded ${censusRecords.length} census records`);
    
    const texts = censusRecords.map(census => this.createCensusText(census));
    
    try {
      const embeddings = await this.callRunPodAPI(texts);
      
      return censusRecords.map((census, idx) => ({
        id: `census_${census.id || `${census.state}_${census.district}`}`,
        type: 'census',
        text: texts[idx],
        embedding: embeddings[idx],
        metadata: census
      }));
    } catch (error) {
      console.error(`  ✗ Census processing failed: ${error.message}`);
      return [];
    }
  }

  async processElectionData(db, table, type) {
    console.log(`\n🗳️ Processing ALL ${type} election data...`);
    const records = db.prepare(`SELECT * FROM ${table}`).all();
    console.log(`  Loaded ${records.length} ${type} records`);
    
    const vectorData = [];
    
    for (let i = 0; i < records.length; i += this.BATCH_SIZE) {
      const batch = records.slice(i, i + this.BATCH_SIZE);
      const texts = batch.map(election => this.createElectionText(election, type));
      
      console.log(`  Processing batch ${Math.floor(i/this.BATCH_SIZE) + 1}/${Math.ceil(records.length/this.BATCH_SIZE)}...`);
      
      try {
        const embeddings = await this.callRunPodAPI(texts);
        
        batch.forEach((election, idx) => {
          vectorData.push({
            id: `${table}_${election.id}`,
            type: table,
            text: texts[idx],
            embedding: embeddings[idx],
            metadata: election
          });
        });
        
        console.log(`    ✓ Processed ${batch.length} records`);
      } catch (error) {
        console.error(`    ✗ Batch failed: ${error.message}`);
      }
    }
    
    return vectorData;
  }

  async build() {
    console.log('🚀 RunPod Vector Builder');
    console.log('========================');
    console.log(`Endpoint: ${this.endpointId}`);
    console.log(`Batch Size: ${this.BATCH_SIZE}`);
    console.log('');

    // Verify endpoint is accessible
    console.log('Verifying RunPod endpoint...');
    try {
      const verification = await this.callRunPodAPI(['Verification check']);
      console.log('✅ RunPod endpoint ready. Embedding dimension:', verification[0].length);
    } catch (error) {
      console.error('❌ RunPod endpoint not accessible:', error.message);
      console.error('Please check your RunPod configuration and try again.');
      process.exit(1);
    }

    const db = new Database('dist/politic-data.db', { readonly: true });
    const allVectors = [];

    // Process ALL data from database
    const boothVectors = await this.processBoothData(db);
    allVectors.push(...boothVectors);

    const censusVectors = await this.processCensusData(db);
    allVectors.push(...censusVectors);

    const mlaVectors = await this.processElectionData(db, 'election_mla', 'MLA');
    allVectors.push(...mlaVectors);

    const mpVectors = await this.processElectionData(db, 'election_mp', 'MP');
    allVectors.push(...mpVectors);

    db.close();

    // Save vector data
    const vectorData = {
      version: new Date().toISOString().split('T')[0],
      metadata: {
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: allVectors[0]?.embedding?.length || 384,
        infrastructure: 'RunPod',
        total_records: allVectors.length,
        processing_time_seconds: Math.round((Date.now() - this.stats.start_time) / 1000)
      },
      entities: allVectors
    };

    console.log('\n💾 Saving vector data...');
    await fs.writeFile('dist/politic-data-vectors.json', JSON.stringify(vectorData, null, 2));
    await fs.writeFile('dist/vector-metadata.json', JSON.stringify(vectorData.metadata, null, 2));

    console.log('\n✅ Vector generation complete!');
    console.log(`  • Total embeddings: ${allVectors.length}`);
    console.log(`  • Processing time: ${vectorData.metadata.processing_time_seconds} seconds`);
    console.log(`  • Output: dist/politic-data-vectors.json`);
  }
}

if (require.main === module) {
  const builder = new RunPodVectorBuilder();
  builder.build().catch(console.error);
}

module.exports = RunPodVectorBuilder;