#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Export vector embeddings to Qdrant format
 * Generates JSON payloads for Qdrant collection import
 */

class QdrantExporter {
  constructor() {
    this.collections = {
      booth: {
        name: 'politic_booth',
        vectors: { size: 384, distance: 'Cosine' },
        points: []
      },
      census: {
        name: 'politic_census',
        vectors: { size: 384, distance: 'Cosine' },
        points: []
      },
      election_mla: {
        name: 'politic_election_mla',
        vectors: { size: 384, distance: 'Cosine' },
        points: []
      },
      election_mp: {
        name: 'politic_election_mp',
        vectors: { size: 384, distance: 'Cosine' },
        points: []
      }
    };
  }

  async loadVectorData() {
    const vectorPath = path.join(process.cwd(), 'dist', 'politic-data-vectors.json');
    const content = await fs.readFile(vectorPath, 'utf-8');
    return JSON.parse(content);
  }

  generatePointId(entity) {
    // Generate deterministic UUID from entity ID
    const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    return uuidv4(entity.id, namespace);
  }

  createBoothPoint(entity) {
    return {
      id: this.generatePointId(entity),
      vector: entity.embedding,
      payload: {
        id: entity.id,
        type: 'booth',
        text: entity.text,
        partId: entity.metadata.partId,
        stateName: entity.metadata.stateName,
        stateCode: entity.metadata.stateCode,
        districtName: entity.metadata.districtName,
        districtCode: entity.metadata.districtCode,
        acName: entity.metadata.acName,
        acNumber: entity.metadata.acNumber,
        partNumber: entity.metadata.partNumber,
        partName: entity.metadata.partName
      }
    };
  }

  createCensusPoint(entity) {
    return {
      id: this.generatePointId(entity),
      vector: entity.embedding,
      payload: {
        id: entity.id,
        type: 'census',
        text: entity.text,
        district: entity.metadata.district,
        state: entity.metadata.state,
        census_year: entity.metadata.census_year,
        total_population: entity.metadata.total_population,
        male_population: entity.metadata.male_population,
        female_population: entity.metadata.female_population,
        sex_ratio: entity.metadata.sex_ratio,
        urban_percentage: entity.metadata.urban_percentage,
        literacy_rate: entity.metadata.literacy_rate
      }
    };
  }

  createElectionMLAPoint(entity) {
    return {
      id: this.generatePointId(entity),
      vector: entity.embedding,
      payload: {
        id: entity.id,
        type: 'election_mla',
        text: entity.text,
        state: entity.metadata.state,
        constituency: entity.metadata.constituency,
        ac_type: entity.metadata.ac_type,
        year: entity.metadata.year,
        candidate_name: entity.metadata.candidate_name,
        party: entity.metadata.party,
        position: entity.metadata.position,
        votes: entity.metadata.votes,
        votes_percentage: entity.metadata.votes_percentage,
        total_electors: entity.metadata.total_electors,
        turnout_percentage: entity.metadata.turnout_percentage
      }
    };
  }

  createElectionMPPoint(entity) {
    return {
      id: this.generatePointId(entity),
      vector: entity.embedding,
      payload: {
        id: entity.id,
        type: 'election_mp',
        text: entity.text,
        state: entity.metadata.state,
        constituency: entity.metadata.constituency,
        pc_type: entity.metadata.pc_type,
        year: entity.metadata.year,
        candidate_name: entity.metadata.candidate_name,
        party: entity.metadata.party,
        position: entity.metadata.position,
        votes: entity.metadata.votes,
        votes_percentage: entity.metadata.votes_percentage,
        total_electors: entity.metadata.total_electors,
        turnout_percentage: entity.metadata.turnout_percentage
      }
    };
  }

  async export() {
    try {
      console.log('Loading vector data...');
      const vectorData = await this.loadVectorData();
      
      console.log('Processing entities for Qdrant...');
      
      for (const entity of vectorData.entities) {
        let point;
        switch (entity.type) {
          case 'booth':
            point = this.createBoothPoint(entity);
            this.collections.booth.points.push(point);
            break;
          case 'census':
            point = this.createCensusPoint(entity);
            this.collections.census.points.push(point);
            break;
          case 'election_mla':
            point = this.createElectionMLAPoint(entity);
            this.collections.election_mla.points.push(point);
            break;
          case 'election_mp':
            point = this.createElectionMPPoint(entity);
            this.collections.election_mp.points.push(point);
            break;
        }
      }
      
      const outputDir = path.join(process.cwd(), 'dist');
      await fs.mkdir(outputDir, { recursive: true });
      
      // Save collection configs and data
      for (const [type, collection] of Object.entries(this.collections)) {
        if (collection.points.length > 0) {
          // Save collection config
          const configPath = path.join(outputDir, `qdrant-${type}-config.json`);
          await fs.writeFile(configPath, JSON.stringify({
            name: collection.name,
            vectors: collection.vectors,
            payload_schema: this.generatePayloadSchema(type)
          }, null, 2));
          
          // Save points data
          const pointsPath = path.join(outputDir, `qdrant-${type}-points.json`);
          await fs.writeFile(pointsPath, JSON.stringify({
            points: collection.points
          }, null, 2));
          
          // Save in batch format for bulk upload
          const batchSize = 100;
          const batches = [];
          for (let i = 0; i < collection.points.length; i += batchSize) {
            batches.push(collection.points.slice(i, i + batchSize));
          }
          
          const batchPath = path.join(outputDir, `qdrant-${type}-batches.jsonl`);
          const batchContent = batches.map(batch => JSON.stringify({ points: batch })).join('\n');
          await fs.writeFile(batchPath, batchContent);
          
          console.log(`Exported ${collection.points.length} ${type} points`);
        }
      }
      
      // Create import script
      const scriptPath = path.join(outputDir, 'qdrant-import.sh');
      const scriptContent = `#!/bin/bash

# Qdrant Import Script for Indian Political Data
# Requires: Qdrant server running and curl installed

QDRANT_HOST=\${QDRANT_HOST:-"localhost"}
QDRANT_PORT=\${QDRANT_PORT:-"6333"}
QDRANT_API_KEY=\${QDRANT_API_KEY:-""}

# Function to create collection
create_collection() {
  local config_file=$1
  local collection_name=$2
  
  echo "Creating collection: $collection_name"
  
  if [ -n "$QDRANT_API_KEY" ]; then
    curl -X PUT "http://\${QDRANT_HOST}:\${QDRANT_PORT}/collections/\${collection_name}" \\
      -H "api-key: \${QDRANT_API_KEY}" \\
      -H "Content-Type: application/json" \\
      -d @"$config_file"
  else
    curl -X PUT "http://\${QDRANT_HOST}:\${QDRANT_PORT}/collections/\${collection_name}" \\
      -H "Content-Type: application/json" \\
      -d @"$config_file"
  fi
}

# Function to upload points
upload_points() {
  local points_file=$1
  local collection_name=$2
  
  echo "Uploading points to: $collection_name"
  
  if [ -n "$QDRANT_API_KEY" ]; then
    curl -X PUT "http://\${QDRANT_HOST}:\${QDRANT_PORT}/collections/\${collection_name}/points" \\
      -H "api-key: \${QDRANT_API_KEY}" \\
      -H "Content-Type: application/json" \\
      -d @"$points_file"
  else
    curl -X PUT "http://\${QDRANT_HOST}:\${QDRANT_PORT}/collections/\${collection_name}/points" \\
      -H "Content-Type: application/json" \\
      -d @"$points_file"
  fi
}

# Create collections and upload data
echo "Starting Qdrant import..."

# Booth collection
if [ -f "qdrant-booth-config.json" ]; then
  create_collection "qdrant-booth-config.json" "politic_booth"
  upload_points "qdrant-booth-points.json" "politic_booth"
fi

# Census collection
if [ -f "qdrant-census-config.json" ]; then
  create_collection "qdrant-census-config.json" "politic_census"
  upload_points "qdrant-census-points.json" "politic_census"
fi

# Election MLA collection
if [ -f "qdrant-election_mla-config.json" ]; then
  create_collection "qdrant-election_mla-config.json" "politic_election_mla"
  upload_points "qdrant-election_mla-points.json" "politic_election_mla"
fi

# Election MP collection
if [ -f "qdrant-election_mp-config.json" ]; then
  create_collection "qdrant-election_mp-config.json" "politic_election_mp"
  upload_points "qdrant-election_mp-points.json" "politic_election_mp"
fi

echo "Qdrant import complete!"
`;
      
      await fs.writeFile(scriptPath, scriptContent);
      await fs.chmod(scriptPath, '755');
      
      // Create Python client example
      const pythonPath = path.join(outputDir, 'qdrant-search-example.py');
      const pythonContent = `#!/usr/bin/env python3

"""
Qdrant Search Example for Indian Political Data
Requirements: pip install qdrant-client
"""

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# Initialize client
client = QdrantClient(host="localhost", port=6333)

# Example: Search for similar polling booths
def search_similar_booths(query_text, limit=5):
    """Search for polling booths similar to the query"""
    
    # In production, you would generate embedding for query_text
    # For demo, using a sample embedding
    query_vector = [0.1] * 384  # Replace with actual embedding
    
    results = client.search(
        collection_name="politic_booth",
        query_vector=query_vector,
        limit=limit
    )
    
    for result in results:
        print(f"Score: {result.score:.4f}")
        print(f"Booth: {result.payload['partName']}")
        print(f"Location: {result.payload['acName']}, {result.payload['districtName']}")
        print(f"State: {result.payload['stateName']}")
        print("-" * 50)

# Example: Search for demographically similar districts
def search_similar_districts(district_name, limit=5):
    """Find districts with similar demographic profiles"""
    
    # First, get the district's embedding
    filter_condition = {
        "must": [
            {"key": "district", "match": {"value": district_name}}
        ]
    }
    
    district_result = client.scroll(
        collection_name="politic_census",
        scroll_filter=filter_condition,
        limit=1
    )[0]
    
    if district_result:
        district_vector = district_result[0].vector
        
        # Search for similar districts
        results = client.search(
            collection_name="politic_census",
            query_vector=district_vector,
            limit=limit + 1  # +1 to exclude self
        )
        
        for result in results[1:]:  # Skip first (self)
            print(f"Score: {result.score:.4f}")
            print(f"District: {result.payload['district']}, {result.payload['state']}")
            print(f"Population: {result.payload['total_population']:,}")
            print(f"Literacy Rate: {result.payload['literacy_rate']:.1f}%")
            print("-" * 50)

# Example: Find election patterns
def find_election_patterns(constituency, year, limit=10):
    """Find constituencies with similar voting patterns"""
    
    filter_condition = {
        "must": [
            {"key": "constituency", "match": {"value": constituency}},
            {"key": "year", "match": {"value": year}}
        ]
    }
    
    election_result = client.scroll(
        collection_name="politic_election_mla",
        scroll_filter=filter_condition,
        limit=1
    )[0]
    
    if election_result:
        election_vector = election_result[0].vector
        
        # Search for similar election results
        results = client.search(
            collection_name="politic_election_mla",
            query_vector=election_vector,
            limit=limit
        )
        
        for result in results:
            print(f"Score: {result.score:.4f}")
            print(f"Constituency: {result.payload['constituency']}, {result.payload['state']}")
            print(f"Year: {result.payload['year']}")
            print(f"Winner: {result.payload['candidate_name']} ({result.payload['party']})")
            print(f"Vote Share: {result.payload['votes_percentage']:.1f}%")
            print("-" * 50)

if __name__ == "__main__":
    print("Qdrant Search Examples")
    print("=" * 50)
    
    # Example searches
    print("\\n1. Similar Polling Booths:")
    search_similar_booths("Government School", limit=5)
    
    print("\\n2. Similar Districts by Demographics:")
    search_similar_districts("Chennai", limit=5)
    
    print("\\n3. Similar Election Patterns:")
    find_election_patterns("Chennai Central", 2021, limit=10)
`;
      
      await fs.writeFile(pythonPath, pythonContent);
      await fs.chmod(pythonPath, '755');
      
      // Create instructions
      const instructionsPath = path.join(outputDir, 'qdrant-import-instructions.md');
      const instructions = `# Qdrant Import Instructions

## Prerequisites
- Qdrant server (v1.7.0+)
- Python 3.8+ (for client examples)
- curl (for import script)

## Quick Start with Docker

1. **Start Qdrant server**
   \`\`\`bash
   docker run -p 6333:6333 -p 6334:6334 \\
     -v $(pwd)/qdrant_storage:/qdrant/storage:z \\
     qdrant/qdrant
   \`\`\`

2. **Import data**
   \`\`\`bash
   chmod +x qdrant-import.sh
   ./qdrant-import.sh
   \`\`\`

## Manual Import

### Create Collections
\`\`\`bash
# Create booth collection
curl -X PUT 'http://localhost:6333/collections/politic_booth' \\
  -H 'Content-Type: application/json' \\
  -d @qdrant-booth-config.json

# Upload booth points
curl -X PUT 'http://localhost:6333/collections/politic_booth/points' \\
  -H 'Content-Type: application/json' \\
  -d @qdrant-booth-points.json
\`\`\`

## Python Client Usage

1. **Install client**
   \`\`\`bash
   pip install qdrant-client
   \`\`\`

2. **Run examples**
   \`\`\`bash
   python qdrant-search-example.py
   \`\`\`

## REST API Examples

### Search similar booths
\`\`\`bash
curl -X POST 'http://localhost:6333/collections/politic_booth/points/search' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "vector": [0.1, 0.2, ...],  # 384-dimensional vector
    "limit": 10,
    "with_payload": true
  }'
\`\`\`

### Filter by state
\`\`\`bash
curl -X POST 'http://localhost:6333/collections/politic_booth/points/search' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "vector": [0.1, 0.2, ...],
    "filter": {
      "must": [
        {"key": "stateName", "match": {"value": "Tamil Nadu"}}
      ]
    },
    "limit": 10
  }'
\`\`\`

## Collection Statistics
- **politic_booth**: ${this.collections.booth.points.length} points
- **politic_census**: ${this.collections.census.points.length} points
- **politic_election_mla**: ${this.collections.election_mla.points.length} points
- **politic_election_mp**: ${this.collections.election_mp.points.length} points

## Performance Tips
1. Use batch upload for large datasets
2. Create indexes on frequently filtered fields
3. Use quantization for memory optimization
4. Enable mmap storage for large collections
`;
      
      await fs.writeFile(instructionsPath, instructions);
      
      console.log(`\n✅ Qdrant export complete!`);
      console.log(`Files created in ${outputDir}:`);
      console.log(`  - Config files: qdrant-*-config.json`);
      console.log(`  - Point data: qdrant-*-points.json`);
      console.log(`  - Batch files: qdrant-*-batches.jsonl`);
      console.log(`  - Import script: qdrant-import.sh`);
      console.log(`  - Python examples: qdrant-search-example.py`);
      console.log(`  - Instructions: qdrant-import-instructions.md`);
      
    } catch (error) {
      console.error('Error exporting to Qdrant:', error);
      process.exit(1);
    }
  }

  generatePayloadSchema(type) {
    // Generate schema based on entity type
    const schemas = {
      booth: {
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        text: { type: 'text' },
        partId: { type: 'integer' },
        stateName: { type: 'keyword', indexed: true },
        stateCode: { type: 'keyword', indexed: true },
        districtName: { type: 'keyword', indexed: true },
        districtCode: { type: 'keyword' },
        acName: { type: 'keyword', indexed: true },
        acNumber: { type: 'integer' },
        partNumber: { type: 'integer' },
        partName: { type: 'text' }
      },
      census: {
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        text: { type: 'text' },
        district: { type: 'keyword', indexed: true },
        state: { type: 'keyword', indexed: true },
        census_year: { type: 'integer', indexed: true },
        total_population: { type: 'integer' },
        male_population: { type: 'integer' },
        female_population: { type: 'integer' },
        sex_ratio: { type: 'integer' },
        urban_percentage: { type: 'float' },
        literacy_rate: { type: 'float' }
      },
      election_mla: {
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        text: { type: 'text' },
        state: { type: 'keyword', indexed: true },
        constituency: { type: 'keyword', indexed: true },
        ac_type: { type: 'keyword' },
        year: { type: 'integer', indexed: true },
        candidate_name: { type: 'keyword', indexed: true },
        party: { type: 'keyword', indexed: true },
        position: { type: 'integer' },
        votes: { type: 'integer' },
        votes_percentage: { type: 'float' },
        total_electors: { type: 'integer' },
        turnout_percentage: { type: 'float' }
      },
      election_mp: {
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        text: { type: 'text' },
        state: { type: 'keyword', indexed: true },
        constituency: { type: 'keyword', indexed: true },
        pc_type: { type: 'keyword' },
        year: { type: 'integer', indexed: true },
        candidate_name: { type: 'keyword', indexed: true },
        party: { type: 'keyword', indexed: true },
        position: { type: 'integer' },
        votes: { type: 'integer' },
        votes_percentage: { type: 'float' },
        total_electors: { type: 'integer' },
        turnout_percentage: { type: 'float' }
      }
    };
    
    return schemas[type] || {};
  }
}

// Run the exporter
if (require.main === module) {
  const exporter = new QdrantExporter();
  exporter.export();
}

module.exports = QdrantExporter;