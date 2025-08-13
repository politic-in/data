#!/usr/bin/env node

/**
 * Build vector embeddings using RunPod.io GPU infrastructure
 * Processes ALL data without limitations using RTX A6000 (48GB VRAM)
 */

// Load environment variables from .env file
const dotenv = require('dotenv');
dotenv.config();

const fs = require('fs').promises;
const path = require('path');
const Database = require('better-sqlite3');
const axios = require('axios');

class RunPodVectorBuilder {
  constructor() {
    // RunPod configuration - you'll need to set these environment variables
    this.endpointId = process.env.RUNPOD_ENDPOINT_ID;
    this.apiKey = process.env.RUNPOD_API_KEY;
    
    if (!this.endpointId || !this.apiKey) {
      console.error('❌ Missing RunPod credentials!');
      console.error('Please set environment variables:');
      console.error('  export RUNPOD_ENDPOINT_ID="your-endpoint-id"');
      console.error('  export RUNPOD_API_KEY="your-api-key"');
      console.error('');
      console.error('To set up RunPod with sentence-transformers:');
      console.error('  1. Sign up at https://www.runpod.io');
      console.error('  2. Create a serverless endpoint with RTX A6000 (48GB VRAM)');
      console.error('  3. Use this Docker image: runpod/serverless-transformers-embedding:latest');
      console.error('  4. Or deploy with: BGE/infinity-embedding for production use');
      process.exit(1);
    }

    // API endpoints - use async endpoint since runsync times out
    this.runpodUrl = `https://api.runpod.ai/v2/${this.endpointId}/run`;
    
    // RTX A6000 with 48GB VRAM can handle MUCH larger batches
    // MiniLM-L6 uses ~350MB for model, leaving ~47GB for data
    // Start with smaller batch size for stability, can increase if needed
    this.BATCH_SIZE = 1000; // Conservative batch size for stability
    this.PARALLEL_REQUESTS = 2; // Reduce parallel requests to avoid queue congestion
    
    this.stats = {
      total_processed: 0,
      booth_processed: 0,
      census_processed: 0,
      mla_processed: 0,
      mp_processed: 0,
      start_time: Date.now()
    };
  }

  async callRunPodAPI(texts, modelName = 'sentence-transformers/all-MiniLM-L6-v2') {
    try {
      // Try the simplest format that should work with most embedding servers
      const response = await axios.post(
        this.runpodUrl,
        {
          input: {
            texts: texts,  // Simple array of texts
            model: 'all-MiniLM-L6-v2'  // Use the model name directly
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 600000 // 10 minute timeout for huge batches
        }
      );

      // Handle IN_QUEUE status - poll until completed
      if (response.data.status === 'IN_QUEUE' || response.data.status === 'IN_PROGRESS') {
        return await this.pollRunPodJob(response.data.id);
      }
      
      // Handle COMPLETED status
      if (response.data.status === 'COMPLETED') {
        if (response.data.output) {
          // Standard format
          if (Array.isArray(response.data.output)) {
            return response.data.output;
          }
          // Nested format
          if (response.data.output.embeddings) {
            return response.data.output.embeddings;
          }
          if (response.data.output.data) {
            return response.data.output.data;
          }
        }
      }
      
      // Handle direct output (synchronous response)
      if (response.data.output) {
        // Standard format
        if (Array.isArray(response.data.output)) {
          return response.data.output;
        }
        // Nested format
        if (response.data.output.embeddings) {
          return response.data.output.embeddings;
        }
        if (response.data.output.data) {
          return response.data.output.data;
        }
      }
      
      // Direct embeddings response
      if (response.data.embeddings) {
        return response.data.embeddings;
      }
      
      throw new Error('Unexpected response format from RunPod: ' + JSON.stringify(response.data).substring(0, 200));
    } catch (error) {
      console.error('RunPod API error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data).substring(0, 500));
      }
      throw error;
    }
  }

  // Poll RunPod job status until completion
  async pollRunPodJob(jobId, maxRetries = 60, retryDelay = 5000) {
    const statusUrl = `https://api.runpod.ai/v2/${this.endpointId}/status/${jobId}`;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(statusUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.status === 'COMPLETED') {
          if (response.data.output) {
            // Standard format
            if (Array.isArray(response.data.output)) {
              return response.data.output;
            }
            // Nested format
            if (response.data.output.embeddings) {
              return response.data.output.embeddings;
            }
            if (response.data.output.data) {
              return response.data.output.data;
            }
          }
          throw new Error('Job completed but no output found');
        } else if (response.data.status === 'FAILED') {
          throw new Error(`RunPod job failed: ${response.data.error || 'Unknown error'}`);
        } else if (response.data.status === 'IN_QUEUE' || response.data.status === 'IN_PROGRESS') {
          // Still processing, wait and retry
          if (i === 0) {
            console.log(`    Job ${jobId} queued, polling for completion...`);
          } else if (i % 10 === 0) {
            console.log(`    Still processing... (${i * retryDelay / 1000}s elapsed)`);
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw new Error(`Unknown job status: ${response.data.status}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          throw new Error(`Job ${jobId} not found`);
        }
        if (i === maxRetries - 1) {
          throw error;
        }
        // Retry on network errors
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    throw new Error(`Job ${jobId} timed out after ${maxRetries * retryDelay / 1000} seconds`);
  }

  // Process multiple batches in parallel to maximize GPU usage
  async processInParallel(items, processor) {
    const results = [];
    const queue = [...items];
    
    const workers = Array(this.PARALLEL_REQUESTS).fill(null).map(async () => {
      const workerResults = [];
      while (queue.length > 0) {
        const batch = queue.splice(0, this.BATCH_SIZE);
        if (batch.length > 0) {
          const result = await processor(batch);
          workerResults.push(...result);
        }
      }
      return workerResults;
    });
    
    const workerOutputs = await Promise.all(workers);
    workerOutputs.forEach(output => results.push(...output));
    return results;
  }

  createBoothText(booth) {
    return `Polling booth ${booth.partName} in ${booth.acName} constituency, ${booth.districtName} district, ${booth.stateName}. Part number ${booth.partNumber}`;
  }

  createCensusText(census) {
    return `${census.district} district in ${census.state} with population ${census.total_population || census.population}. Census year ${census.census_year}`;
  }

  createElectionText(election, type) {
    return `${election.candidate_name} from ${election.party} contested in ${election.constituency} ${type} constituency, ${election.state} in ${election.year} election. Received ${election.votes} votes`;
  }

  async processAllBoothData(db) {
    console.log('\n📍 Processing ALL booth data with parallel GPU processing...');
    const totalBooths = db.prepare('SELECT COUNT(*) as count FROM booth').get().count;
    console.log(`  Total booths: ${totalBooths.toLocaleString()}`);
    console.log(`  Batch size: ${this.BATCH_SIZE.toLocaleString()} (optimized for RTX A6000)`);
    console.log(`  Parallel requests: ${this.PARALLEL_REQUESTS}`);
    
    // Load ALL booths into memory (we have enough RAM)
    console.log('  Loading all booth data into memory...');
    const allBooths = db.prepare('SELECT * FROM booth').all();
    
    // Process booths in parallel batches
    const processor = async (boothBatch) => {
      const texts = boothBatch.map(booth => this.createBoothText(booth));
      const embeddings = await this.callRunPodAPI(texts);
      
      return boothBatch.map((booth, idx) => ({
        id: `booth_${booth.partId}`,
        type: 'booth',
        text: texts[idx],
        embedding: Array.isArray(embeddings[idx]) ? embeddings[idx] : Array.from(embeddings[idx]),
        metadata: {
          partId: booth.partId,
          stateName: booth.stateName,
          stateCode: booth.stateCode,
          districtName: booth.districtName,
          districtCode: booth.districtCode,
          acName: booth.acName,
          acNumber: booth.acNumber,
          partNumber: booth.partNumber,
          partName: booth.partName
        }
      }));
    };
    
    console.log('  Starting parallel GPU processing...');
    const startTime = Date.now();
    
    // Split into chunks for parallel processing
    const chunks = [];
    for (let i = 0; i < allBooths.length; i += this.BATCH_SIZE) {
      chunks.push(allBooths.slice(i, i + this.BATCH_SIZE));
    }
    
    // Process with progress tracking
    const vectorData = [];
    let processedChunks = 0;
    
    // Process in groups of PARALLEL_REQUESTS
    for (let i = 0; i < chunks.length; i += this.PARALLEL_REQUESTS) {
      const chunkGroup = chunks.slice(i, i + this.PARALLEL_REQUESTS);
      const promises = chunkGroup.map(chunk => processor(chunk));
      
      const results = await Promise.all(promises);
      results.forEach(result => vectorData.push(...result));
      
      processedChunks += chunkGroup.length;
      this.stats.booth_processed = vectorData.length;
      this.stats.total_processed = vectorData.length;
      
      // Progress update
      const progress = ((processedChunks / chunks.length) * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(vectorData.length / elapsed);
      const eta = Math.round((totalBooths - vectorData.length) / rate);
      console.log(`    ✓ Batches: ${processedChunks}/${chunks.length} | Progress: ${progress}% | Rate: ${rate} rec/s | ETA: ${eta}s`);
    }
    
    const elapsed = (Date.now() - startTime) / 1000;
    const finalRate = Math.round(totalBooths / elapsed);
    console.log(`  ✅ Completed ${totalBooths.toLocaleString()} booths in ${elapsed.toFixed(1)}s (${finalRate} rec/s)`);
    return vectorData;
  }

  async processAllCensusData(db) {
    console.log('\n📊 Processing ALL census data with GPU acceleration...');
    const censusRecords = db.prepare('SELECT * FROM census').all();
    console.log(`  Total census records: ${censusRecords.length}`);
    
    // Since census is smaller, process in one batch if possible
    const texts = censusRecords.map(census => this.createCensusText(census));
    const embeddings = await this.callRunPodAPI(texts);
    
    const vectorData = censusRecords.map((census, idx) => ({
      id: `census_${census.id || `${census.state}_${census.district}`}`,
      type: 'census',
      text: texts[idx],
      embedding: Array.isArray(embeddings[idx]) ? embeddings[idx] : Array.from(embeddings[idx]),
      metadata: {
        district: census.district,
        state: census.state,
        census_year: census.census_year,
        total_population: census.total_population || census.population,
        male_population: census.male_population || census.male,
        female_population: census.female_population || census.female,
        sex_ratio: census.sex_ratio,
        urban_percentage: census.urban_percentage,
        literacy_rate: census.literacy_rate
      }
    }));
    
    this.stats.census_processed = censusRecords.length;
    this.stats.total_processed += censusRecords.length;
    
    console.log(`  ✅ Completed all ${censusRecords.length} census records`);
    return vectorData;
  }

  async processAllElectionData(db, type = 'mla') {
    const table = type === 'mla' ? 'election_mla' : 'election_mp';
    const displayType = type.toUpperCase();
    
    console.log(`\n🗳️ Processing ALL ${displayType} election data with parallel GPU...`);
    const allElections = db.prepare(`SELECT * FROM ${table}`).all();
    console.log(`  Total ${displayType} records: ${allElections.length.toLocaleString()}`);
    
    // Process elections in parallel batches
    const processor = async (electionBatch) => {
      const texts = electionBatch.map(election => this.createElectionText(election, displayType));
      const embeddings = await this.callRunPodAPI(texts);
      
      return electionBatch.map((election, idx) => ({
        id: `${table}_${election.id}`,
        type: table,
        text: texts[idx],
        embedding: Array.isArray(embeddings[idx]) ? embeddings[idx] : Array.from(embeddings[idx]),
        metadata: {
          state: election.state,
          constituency: election.constituency,
          [type === 'mla' ? 'ac_type' : 'pc_type']: election[type === 'mla' ? 'ac_type' : 'pc_type'],
          year: election.year,
          candidate_name: election.candidate_name,
          party: election.party,
          position: election.position,
          votes: election.votes,
          votes_percentage: election.votes_percentage,
          total_electors: election.total_electors,
          turnout_percentage: election.turnout_percentage
        }
      }));
    };
    
    const startTime = Date.now();
    
    // Split into chunks
    const chunks = [];
    for (let i = 0; i < allElections.length; i += this.BATCH_SIZE) {
      chunks.push(allElections.slice(i, i + this.BATCH_SIZE));
    }
    
    // Process in parallel
    const vectorData = [];
    for (let i = 0; i < chunks.length; i += this.PARALLEL_REQUESTS) {
      const chunkGroup = chunks.slice(i, i + this.PARALLEL_REQUESTS);
      const promises = chunkGroup.map(chunk => processor(chunk));
      
      const results = await Promise.all(promises);
      results.forEach(result => vectorData.push(...result));
      
      this.stats[`${type}_processed`] = vectorData.length;
      this.stats.total_processed += vectorData.length - this.stats[`${type}_processed`];
      
      const progress = ((i + chunkGroup.length) / chunks.length * 100).toFixed(1);
      console.log(`    ✓ Progress: ${progress}% (${vectorData.length}/${allElections.length})`);
    }
    
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = Math.round(allElections.length / elapsed);
    console.log(`  ✅ Completed ${allElections.length.toLocaleString()} ${displayType} records at ${rate} rec/s`);
    return vectorData;
  }

  async build() {
    console.log('🚀 RunPod GPU Vector Builder');
    console.log('================================');
    console.log(`Endpoint: ${this.endpointId}`);
    console.log(`GPU: RTX A6000 (48GB VRAM)`);
    console.log(`Batch Size: ${this.BATCH_SIZE.toLocaleString()} texts per batch`);
    console.log(`Parallel Requests: ${this.PARALLEL_REQUESTS} concurrent GPU calls`);
    console.log('');

    // Open database
    const db = new Database('dist/politic-data.db', { readonly: true });

    // Get total counts
    const totalBooths = db.prepare('SELECT COUNT(*) as count FROM booth').get().count;
    const totalCensus = db.prepare('SELECT COUNT(*) as count FROM census').get().count;
    const totalMLA = db.prepare('SELECT COUNT(*) as count FROM election_mla').get().count;
    const totalMP = db.prepare('SELECT COUNT(*) as count FROM election_mp').get().count;
    const grandTotal = totalBooths + totalCensus + totalMLA + totalMP;

    console.log('📊 Database Statistics:');
    console.log(`  • Booths: ${totalBooths.toLocaleString()}`);
    console.log(`  • Census: ${totalCensus.toLocaleString()}`);
    console.log(`  • MLA Elections: ${totalMLA.toLocaleString()}`);
    console.log(`  • MP Elections: ${totalMP.toLocaleString()}`);
    console.log(`  • TOTAL: ${grandTotal.toLocaleString()} records`);
    console.log('');
    console.log('⚡ Using RunPod RTX A6000 GPU for acceleration');
    console.log('');

    // Process all data types
    const allVectors = [];
    
    // Process booths
    const boothVectors = await this.processAllBoothData(db);
    allVectors.push(...boothVectors);
    
    // Process census
    const censusVectors = await this.processAllCensusData(db);
    allVectors.push(...censusVectors);
    
    // Process MLA elections
    const mlaVectors = await this.processAllElectionData(db, 'mla');
    allVectors.push(...mlaVectors);
    
    // Process MP elections
    const mpVectors = await this.processAllElectionData(db, 'mp');
    allVectors.push(...mpVectors);
    
    // Close database
    db.close();
    
    // Prepare final data structure
    const vectorData = {
      version: new Date().toISOString().split('T')[0],
      metadata: {
        model: 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: 384,
        infrastructure: 'RunPod RTX A6000',
        total_records: grandTotal,
        total_embeddings: allVectors.length,
        processing_time_seconds: Math.round((Date.now() - this.stats.start_time) / 1000),
        statistics: {
          booth: { processed: this.stats.booth_processed, total: totalBooths },
          census: { processed: this.stats.census_processed, total: totalCensus },
          election_mla: { processed: this.stats.mla_processed, total: totalMLA },
          election_mp: { processed: this.stats.mp_processed, total: totalMP }
        }
      },
      entities: allVectors
    };
    
    // Save to file
    console.log('\n💾 Saving vector data...');
    const outputPath = 'dist/politic-data-vectors.json';
    await fs.writeFile(outputPath, JSON.stringify(vectorData, null, 2));
    
    // Save metadata separately for quick access
    const metadataPath = 'dist/vector-metadata.json';
    await fs.writeFile(metadataPath, JSON.stringify(vectorData.metadata, null, 2));
    
    // Final statistics
    const elapsed = (Date.now() - this.stats.start_time) / 1000;
    const rate = Math.round(this.stats.total_processed / elapsed);
    const gpuUtilization = ((this.stats.total_processed / elapsed) / 1000 * 100).toFixed(1); // Assuming 1000 rec/s is 100% for RTX A6000
    
    console.log('\n✅ Vector generation complete!');
    console.log('=======================================================');
    console.log(`  • Total embeddings: ${allVectors.length.toLocaleString()}`);
    console.log(`  • Processing time: ${elapsed.toFixed(1)} seconds (${(elapsed/60).toFixed(1)} minutes)`);
    console.log(`  • Average rate: ${rate} records/second`);
    console.log(`  • GPU efficiency: ~${gpuUtilization}% utilization`);
    console.log(`  • Output file: ${outputPath}`);
    console.log(`  • File size: ${((JSON.stringify(vectorData).length) / 1024 / 1024).toFixed(2)} MB`);
    console.log('\n📌 This output is compatible with:');
    console.log('  • Neo4j (via export-to-neo4j.js)');
    console.log('  • Qdrant (via export-to-qdrant.js)');
    console.log('  • Elasticsearch (via export-to-elasticsearch.js)');
  }
}

// Run if called directly
if (require.main === module) {
  const builder = new RunPodVectorBuilder();
  builder.build().catch(console.error);
}

module.exports = RunPodVectorBuilder;