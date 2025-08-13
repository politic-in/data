#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Export data to Elasticsearch bulk format
 * Creates NDJSON files ready for bulk import
 */

class ElasticsearchExporter {
  constructor() {
    this.indices = {
      booth: {
        name: 'politic-booth',
        mappings: {
          properties: {
            partId: { type: 'long' },
            stateCd: { type: 'keyword' },
            districtCd: { type: 'keyword' },
            acNumber: { type: 'integer' },
            partNumber: { type: 'integer' },
            partName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            acName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            districtCode: { type: 'keyword' },
            districtName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            stateCode: { type: 'keyword' },
            stateName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            location: { type: 'geo_point' },
            searchText: { type: 'text' }
          }
        },
        documents: []
      },
      census: {
        name: 'politic-census',
        mappings: {
          properties: {
            district: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            state: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            census_year: { type: 'integer' },
            source: { type: 'keyword' },
            population: {
              properties: {
                total: { type: 'long' },
                male: { type: 'long' },
                female: { type: 'long' },
                sex_ratio: { type: 'integer' }
              }
            },
            area_distribution: {
              properties: {
                urban: {
                  properties: {
                    percentage_of_total_population: { type: 'float' },
                    total_population: { type: 'long' },
                    male: { type: 'long' },
                    female: { type: 'long' },
                    sex_ratio: { type: 'integer' },
                    literacy: {
                      properties: {
                        rate: { type: 'float' },
                        male_rate: { type: 'float' },
                        female_rate: { type: 'float' }
                      }
                    }
                  }
                },
                rural: {
                  properties: {
                    percentage_of_total_population: { type: 'float' },
                    total_population: { type: 'long' },
                    male: { type: 'long' },
                    female: { type: 'long' },
                    sex_ratio: { type: 'integer' },
                    literacy: {
                      properties: {
                        rate: { type: 'float' },
                        male_rate: { type: 'float' },
                        female_rate: { type: 'float' }
                      }
                    }
                  }
                }
              }
            },
            searchText: { type: 'text' }
          }
        },
        documents: []
      },
      'election-mla': {
        name: 'politic-election-mla',
        mappings: {
          properties: {
            state: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            constituency: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            district: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            ac_type: { type: 'keyword' },
            year: { type: 'integer' },
            poll_date: { type: 'date', format: 'dd MMMM yyyy||yyyy-MM-dd' },
            counting_date: { type: 'date', format: 'dd MMMM yyyy||yyyy-MM-dd' },
            total_contestants: { type: 'integer' },
            total_electors: { type: 'long' },
            total_votes_polled: { type: 'long' },
            turnout_percentage: { type: 'float' },
            margin_votes: { type: 'integer' },
            margin_percentage: { type: 'float' },
            candidate_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            party: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            position: { type: 'integer' },
            votes: { type: 'long' },
            votes_percentage: { type: 'float' },
            is_winner: { type: 'boolean' },
            searchText: { type: 'text' }
          }
        },
        documents: []
      },
      'election-mp': {
        name: 'politic-election-mp',
        mappings: {
          properties: {
            state: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            constituency: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            pc_type: { type: 'keyword' },
            year: { type: 'integer' },
            poll_date: { type: 'date', format: 'dd MMMM yyyy||yyyy-MM-dd' },
            counting_date: { type: 'date', format: 'dd MMMM yyyy||yyyy-MM-dd' },
            total_contestants: { type: 'integer' },
            total_electors: { type: 'long' },
            total_votes_polled: { type: 'long' },
            turnout_percentage: { type: 'float' },
            margin_votes: { type: 'integer' },
            margin_percentage: { type: 'float' },
            candidate_name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            party: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            position: { type: 'integer' },
            votes: { type: 'long' },
            votes_percentage: { type: 'float' },
            is_winner: { type: 'boolean' },
            searchText: { type: 'text' }
          }
        },
        documents: []
      }
    };
  }

  async processBoothData() {
    console.log('Processing booth data for Elasticsearch...');
    const boothFiles = await this.getJsonFiles('booth');
    
    for (const file of boothFiles) {
      const data = await this.readJsonFile(file);
      if (Array.isArray(data)) {
        for (const booth of data) {
          const doc = {
            ...booth,
            searchText: `${booth.partName} ${booth.acName} ${booth.districtName} ${booth.stateName}`.toLowerCase()
          };
          
          // Add geo_point if coordinates are available (placeholder for future)
          // doc.location = { lat: booth.latitude, lon: booth.longitude };
          
          this.indices.booth.documents.push(doc);
        }
      }
    }
  }

  async processCensusData() {
    console.log('Processing census data for Elasticsearch...');
    const censusFiles = await this.getJsonFiles('census');
    
    for (const file of censusFiles) {
      const data = await this.readJsonFile(file);
      if (data && data.district) {
        const doc = {
          ...data,
          searchText: `${data.district} ${data.state} population ${data.population.total} literacy ${data.area_distribution.urban.literacy.rate}`.toLowerCase()
        };
        
        this.indices.census.documents.push(doc);
      }
    }
  }

  async processElectionMLAData() {
    console.log('Processing MLA election data for Elasticsearch...');
    const mlaFiles = await this.getJsonFiles('election-mla');
    
    for (const file of mlaFiles) {
      const data = await this.readJsonFile(file);
      if (data && data.results) {
        for (const [year, yearData] of Object.entries(data.results)) {
          if (yearData.candidates) {
            for (const candidate of yearData.candidates) {
              const doc = {
                state: data.state,
                constituency: data.constituency,
                district: data.district || '',
                ac_type: data.ac_type || 'GEN',
                year: parseInt(year),
                poll_date: yearData.poll_date,
                counting_date: yearData.counting_date,
                total_contestants: yearData.total_contestants,
                total_electors: yearData.aggregate?.total_electors,
                total_votes_polled: yearData.aggregate?.total_votes_polled,
                turnout_percentage: yearData.aggregate?.turnout_percentage,
                margin_votes: yearData.aggregate?.margin_votes,
                margin_percentage: yearData.aggregate?.margin_percentage,
                candidate_name: candidate.name,
                party: candidate.party,
                position: candidate.position,
                votes: candidate.votes,
                votes_percentage: candidate.votes_percentage,
                is_winner: candidate.position === 1,
                searchText: `${data.constituency} ${data.state} ${candidate.name} ${candidate.party} ${year}`.toLowerCase()
              };
              
              this.indices['election-mla'].documents.push(doc);
            }
          }
        }
      }
    }
  }

  async processElectionMPData() {
    console.log('Processing MP election data for Elasticsearch...');
    const mpFiles = await this.getJsonFiles('election-mp');
    
    for (const file of mpFiles) {
      const data = await this.readJsonFile(file);
      if (data && data.results) {
        for (const [year, yearData] of Object.entries(data.results)) {
          if (yearData.candidates) {
            for (const candidate of yearData.candidates) {
              const doc = {
                state: data.state,
                constituency: data.constituency,
                pc_type: data.pc_type || 'GEN',
                year: parseInt(year),
                poll_date: yearData.poll_date,
                counting_date: yearData.counting_date,
                total_contestants: yearData.total_contestants,
                total_electors: yearData.aggregate?.total_electors,
                total_votes_polled: yearData.aggregate?.total_votes_polled,
                turnout_percentage: yearData.aggregate?.turnout_percentage,
                margin_votes: yearData.aggregate?.margin_votes,
                margin_percentage: yearData.aggregate?.margin_percentage,
                candidate_name: candidate.name,
                party: candidate.party,
                position: candidate.position,
                votes: candidate.votes,
                votes_percentage: candidate.votes_percentage,
                is_winner: candidate.position === 1,
                searchText: `${data.constituency} ${data.state} ${candidate.name} ${candidate.party} ${year} lok sabha`.toLowerCase()
              };
              
              this.indices['election-mp'].documents.push(doc);
            }
          }
        }
      }
    }
  }

  async getJsonFiles(dataType) {
    const files = [];
    const baseDir = path.join(process.cwd(), dataType);
    
    try {
      const states = await fs.readdir(baseDir);
      for (const state of states) {
        const statePath = path.join(baseDir, state);
        const stat = await fs.stat(statePath);
        if (stat.isDirectory()) {
          const stateFiles = await fs.readdir(statePath);
          for (const file of stateFiles) {
            if (file.endsWith('.json')) {
              files.push(path.join(statePath, file));
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: ${dataType} directory not found or empty`);
    }
    
    return files;
  }

  async readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error.message);
      return null;
    }
  }

  async exportBulkData() {
    const outputDir = path.join(process.cwd(), 'dist');
    await fs.mkdir(outputDir, { recursive: true });
    
    let totalDocuments = 0;
    
    for (const [type, index] of Object.entries(this.indices)) {
      if (index.documents.length > 0) {
        // Export mappings
        const mappingsPath = path.join(outputDir, `elasticsearch-${type}-mappings.json`);
        await fs.writeFile(mappingsPath, JSON.stringify({
          mappings: index.mappings,
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                default: {
                  type: 'standard'
                }
              }
            }
          }
        }, null, 2));
        
        // Export bulk data in NDJSON format
        const bulkPath = path.join(outputDir, `elasticsearch-${type}-bulk.ndjson`);
        const bulkStream = [];
        
        for (const doc of index.documents) {
          // Add index action
          bulkStream.push(JSON.stringify({ index: { _index: index.name } }));
          // Add document
          bulkStream.push(JSON.stringify(doc));
        }
        
        await fs.writeFile(bulkPath, bulkStream.join('\n') + '\n');
        
        console.log(`Exported ${index.documents.length} documents for ${type}`);
        totalDocuments += index.documents.length;
      }
    }
    
    // Create combined export with all indices
    const combinedBulkPath = path.join(outputDir, 'elasticsearch-all-bulk.ndjson');
    const combinedStream = [];
    
    for (const [type, index] of Object.entries(this.indices)) {
      for (const doc of index.documents) {
        combinedStream.push(JSON.stringify({ index: { _index: index.name } }));
        combinedStream.push(JSON.stringify(doc));
      }
    }
    
    if (combinedStream.length > 0) {
      await fs.writeFile(combinedBulkPath, combinedStream.join('\n') + '\n');
    }
    
    // Create import script
    await this.createImportScript();
    
    // Create metadata
    const metadataPath = path.join(outputDir, 'elasticsearch-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify({
      version: new Date().toISOString().split('T')[0],
      total_documents: totalDocuments,
      indices: Object.entries(this.indices).map(([type, index]) => ({
        name: index.name,
        type: type,
        document_count: index.documents.length
      }))
    }, null, 2));
    
    console.log(`\n✅ Elasticsearch export complete!`);
    console.log(`Total documents exported: ${totalDocuments}`);
  }

  async createImportScript() {
    const outputDir = path.join(process.cwd(), 'dist');
    const scriptPath = path.join(outputDir, 'elasticsearch-import.sh');
    
    const scriptContent = `#!/bin/bash

# Elasticsearch Import Script for Indian Political Data
# Supports both Elasticsearch OSS and OpenSearch

ES_HOST=\${ES_HOST:-"localhost"}
ES_PORT=\${ES_PORT:-"9200"}
ES_USER=\${ES_USER:-""}
ES_PASS=\${ES_PASS:-""}

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Function to make ES request
es_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -n "$ES_USER" ] && [ -n "$ES_PASS" ]; then
    AUTH="-u $ES_USER:$ES_PASS"
  else
    AUTH=""
  fi
  
  if [ -n "$data" ]; then
    curl -s -X $method $AUTH \\
      -H "Content-Type: application/json" \\
      "http://$ES_HOST:$ES_PORT$endpoint" \\
      -d "$data"
  else
    curl -s -X $method $AUTH \\
      "http://$ES_HOST:$ES_PORT$endpoint"
  fi
}

# Check Elasticsearch connection
echo -e "$YELLOW Checking Elasticsearch connection...$NC"
HEALTH=$(es_request GET "/_cluster/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ -z "$HEALTH" ]; then
  echo -e "$RED Failed to connect to Elasticsearch at $ES_HOST:$ES_PORT$NC"
  exit 1
fi

echo -e "$GREEN Elasticsearch cluster status: $HEALTH$NC"

# Create indices with mappings
echo -e "$YELLOW Creating indices...$NC"

# Booth index
if [ -f "elasticsearch-booth-mappings.json" ]; then
  echo "Creating politic-booth index..."
  es_request DELETE "/politic-booth" > /dev/null 2>&1
  es_request PUT "/politic-booth" "@elasticsearch-booth-mappings.json"
fi

# Census index
if [ -f "elasticsearch-census-mappings.json" ]; then
  echo "Creating politic-census index..."
  es_request DELETE "/politic-census" > /dev/null 2>&1
  es_request PUT "/politic-census" "@elasticsearch-census-mappings.json"
fi

# Election MLA index
if [ -f "elasticsearch-election-mla-mappings.json" ]; then
  echo "Creating politic-election-mla index..."
  es_request DELETE "/politic-election-mla" > /dev/null 2>&1
  es_request PUT "/politic-election-mla" "@elasticsearch-election-mla-mappings.json"
fi

# Election MP index
if [ -f "elasticsearch-election-mp-mappings.json" ]; then
  echo "Creating politic-election-mp index..."
  es_request DELETE "/politic-election-mp" > /dev/null 2>&1
  es_request PUT "/politic-election-mp" "@elasticsearch-election-mp-mappings.json"
fi

# Import bulk data
echo -e "$YELLOW Importing data...$NC"

if [ -f "elasticsearch-all-bulk.ndjson" ]; then
  echo "Importing all data in bulk..."
  curl -s -X POST $AUTH \\
    -H "Content-Type: application/x-ndjson" \\
    "http://$ES_HOST:$ES_PORT/_bulk" \\
    --data-binary "@elasticsearch-all-bulk.ndjson" > bulk-response.json
  
  ERRORS=$(grep -o '"errors":true' bulk-response.json)
  if [ -n "$ERRORS" ]; then
    echo -e "$RED Some documents failed to import. Check bulk-response.json for details.$NC"
  else
    echo -e "$GREEN Bulk import successful!$NC"
  fi
  rm -f bulk-response.json
else
  # Import individual indices
  for INDEX in booth census election-mla election-mp; do
    if [ -f "elasticsearch-$INDEX-bulk.ndjson" ]; then
      echo "Importing $INDEX data..."
      curl -s -X POST $AUTH \\
        -H "Content-Type: application/x-ndjson" \\
        "http://$ES_HOST:$ES_PORT/_bulk" \\
        --data-binary "@elasticsearch-$INDEX-bulk.ndjson" > /dev/null
    fi
  done
fi

# Refresh indices
echo -e "$YELLOW Refreshing indices...$NC"
es_request POST "/_refresh"

# Show index stats
echo -e "$GREEN\\nImport complete! Index statistics:$NC"
for INDEX in politic-booth politic-census politic-election-mla politic-election-mp; do
  COUNT=$(es_request GET "/$INDEX/_count" | grep -o '"count":[0-9]*' | cut -d: -f2)
  if [ -n "$COUNT" ]; then
    echo "  $INDEX: $COUNT documents"
  fi
done

echo -e "$GREEN\\nYou can now search the data:$NC"
echo "  curl -X GET 'http://$ES_HOST:$ES_PORT/politic-booth/_search?q=Mumbai'"
`;
    
    await fs.writeFile(scriptPath, scriptContent);
    await fs.chmod(scriptPath, '755');
    
    // Create Python search example
    const pythonPath = path.join(outputDir, 'elasticsearch-search.py');
    const pythonContent = `#!/usr/bin/env python3

"""
Elasticsearch Search Examples for Indian Political Data
Requirements: pip install elasticsearch
"""

from elasticsearch import Elasticsearch
import json

# Initialize client
es = Elasticsearch(['http://localhost:9200'])

def search_booths(query, state=None, district=None):
    """Search polling booths"""
    body = {
        "query": {
            "bool": {
                "must": [
                    {"match": {"searchText": query}}
                ]
            }
        },
        "size": 10
    }
    
    # Add filters
    if state:
        body["query"]["bool"]["must"].append({"term": {"stateName.keyword": state}})
    if district:
        body["query"]["bool"]["must"].append({"term": {"districtName.keyword": district}})
    
    res = es.search(index="politic-booth", body=body)
    
    print(f"Found {res['hits']['total']['value']} booths")
    for hit in res['hits']['hits']:
        booth = hit['_source']
        print(f"- {booth['partName']} ({booth['acName']}, {booth['districtName']})")

def search_census(min_population=None, max_population=None, min_literacy=None):
    """Search census data with filters"""
    body = {
        "query": {"bool": {"must": []}},
        "size": 10
    }
    
    # Add range filters
    if min_population or max_population:
        range_query = {"range": {"population.total": {}}}
        if min_population:
            range_query["range"]["population.total"]["gte"] = min_population
        if max_population:
            range_query["range"]["population.total"]["lte"] = max_population
        body["query"]["bool"]["must"].append(range_query)
    
    if min_literacy:
        body["query"]["bool"]["must"].append({
            "range": {"area_distribution.urban.literacy.rate": {"gte": min_literacy}}
        })
    
    if not body["query"]["bool"]["must"]:
        body["query"] = {"match_all": {}}
    
    res = es.search(index="politic-census", body=body)
    
    print(f"Found {res['hits']['total']['value']} districts")
    for hit in res['hits']['hits']:
        census = hit['_source']
        print(f"- {census['district']}, {census['state']}: Pop {census['population']['total']:,}, Literacy {census['area_distribution']['urban']['literacy']['rate']:.1f}%")

def search_elections(party=None, year=None, constituency=None):
    """Search election results"""
    body = {
        "query": {"bool": {"must": []}},
        "size": 20,
        "sort": [{"votes": {"order": "desc"}}]
    }
    
    if party:
        body["query"]["bool"]["must"].append({"match": {"party": party}})
    if year:
        body["query"]["bool"]["must"].append({"term": {"year": year}})
    if constituency:
        body["query"]["bool"]["must"].append({"match": {"constituency": constituency}})
    
    if not body["query"]["bool"]["must"]:
        body["query"] = {"match_all": {}}
    
    res = es.search(index="politic-election-mla", body=body)
    
    print(f"Found {res['hits']['total']['value']} results")
    for hit in res['hits']['hits']:
        result = hit['_source']
        winner = "🏆" if result.get('is_winner') else ""
        print(f"- {result['year']} {result['constituency']}: {result['candidate_name']} ({result['party']}) - {result['votes']:,} votes {winner}")

def aggregations_example():
    """Example aggregations"""
    # Party performance across years
    body = {
        "size": 0,
        "aggs": {
            "by_party": {
                "terms": {"field": "party.keyword", "size": 10},
                "aggs": {
                    "total_votes": {"sum": {"field": "votes"}},
                    "avg_vote_share": {"avg": {"field": "votes_percentage"}}
                }
            }
        }
    }
    
    res = es.search(index="politic-election-mla", body=body)
    
    print("\\nTop parties by total votes:")
    for bucket in res['aggregations']['by_party']['buckets']:
        print(f"- {bucket['key']}: {bucket['total_votes']['value']:,.0f} votes, {bucket['avg_vote_share']['value']:.1f}% avg share")

if __name__ == "__main__":
    print("Elasticsearch Search Examples")
    print("=" * 50)
    
    print("\\n1. Search Polling Booths:")
    search_booths("school", state="Tamil Nadu")
    
    print("\\n2. Search Census Data:")
    search_census(min_population=500000, min_literacy=80)
    
    print("\\n3. Search Elections:")
    search_elections(party="BJP", year=2019)
    
    print("\\n4. Aggregations:")
    aggregations_example()
`;
    
    await fs.writeFile(pythonPath, pythonContent);
    await fs.chmod(pythonPath, '755');
  }

  async export() {
    try {
      // Process all data types
      await this.processBoothData();
      await this.processCensusData();
      await this.processElectionMLAData();
      await this.processElectionMPData();
      
      // Export to Elasticsearch bulk format
      await this.exportBulkData();
      
    } catch (error) {
      console.error('Error exporting to Elasticsearch:', error);
      process.exit(1);
    }
  }
}

// Run the exporter
if (require.main === module) {
  const exporter = new ElasticsearchExporter();
  exporter.export();
}

module.exports = ElasticsearchExporter;