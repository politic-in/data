#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * Creates a unified delta format that can be consumed by any database
 * Output format: JSONL with metadata and changed records
 */

class UnifiedDeltaBuilder {
  constructor() {
    this.delta = {
      metadata: {
        version: new Date().toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
        format_version: '1.0',
        description: 'Unified delta format for Indian Political Data',
        changes: {
          booth: { added: 0, modified: 0, deleted: 0 },
          census: { added: 0, modified: 0, deleted: 0 },
          'election-mla': { added: 0, modified: 0, deleted: 0 },
          'election-mp': { added: 0, modified: 0, deleted: 0 }
        }
      },
      records: []
    };
  }

  async getChangedFiles() {
    try {
      // Get the last release tag
      const lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo ""', { encoding: 'utf-8' }).trim();
      
      let changedFiles;
      if (lastTag) {
        // Get files changed since last tag
        changedFiles = execSync(`git diff --name-only ${lastTag}..HEAD -- '*.json' | grep -E '^(booth|census|election-mla|election-mp)/'`, { encoding: 'utf-8' })
          .trim()
          .split('\n')
          .filter(f => f);
      } else {
        // If no tags, get files changed in last 7 days
        changedFiles = execSync(`git diff --name-only HEAD~7..HEAD -- '*.json' | grep -E '^(booth|census|election-mla|election-mp)/' || echo ""`, { encoding: 'utf-8' })
          .trim()
          .split('\n')
          .filter(f => f);
      }
      
      return changedFiles;
    } catch (error) {
      console.warn('Could not determine changed files from git:', error.message);
      return [];
    }
  }

  async processFile(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    
    try {
      // Determine data type from path
      const dataType = filePath.split('/')[0];
      const state = filePath.split('/')[1];
      const fileName = path.basename(filePath, '.json');
      
      // Read current file content
      const currentContent = await fs.readFile(fullPath, 'utf-8');
      const currentData = JSON.parse(currentContent);
      
      // Get previous content from git (if exists)
      let previousData = null;
      let changeType = 'added';
      
      try {
        const lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo ""', { encoding: 'utf-8' }).trim();
        if (lastTag) {
          const previousContent = execSync(`git show ${lastTag}:${filePath} 2>/dev/null`, { encoding: 'utf-8' });
          previousData = JSON.parse(previousContent);
          changeType = 'modified';
        }
      } catch (e) {
        // File didn't exist in previous version
        changeType = 'added';
      }
      
      // Process based on data type
      if (dataType === 'booth' || dataType === 'census') {
        // These are arrays or single objects
        if (Array.isArray(currentData)) {
          // For arrays, detect individual record changes
          const previousMap = new Map();
          if (previousData && Array.isArray(previousData)) {
            previousData.forEach(item => {
              const key = item.partId || `${item.district}_${item.state}`;
              previousMap.set(key, item);
            });
          }
          
          currentData.forEach(item => {
            const key = item.partId || `${item.district}_${item.state}`;
            const prevItem = previousMap.get(key);
            
            let recordChangeType = prevItem ? 'modified' : 'added';
            if (prevItem && JSON.stringify(prevItem) === JSON.stringify(item)) {
              return; // No change
            }
            
            this.delta.records.push({
              operation: recordChangeType,
              type: dataType,
              state: state,
              file: fileName,
              timestamp: new Date().toISOString(),
              record: item,
              previous: recordChangeType === 'modified' ? prevItem : null
            });
            
            this.delta.metadata.changes[dataType][recordChangeType]++;
          });
          
          // Check for deletions
          if (previousData && Array.isArray(previousData)) {
            previousData.forEach(prevItem => {
              const key = prevItem.partId || `${prevItem.district}_${prevItem.state}`;
              const exists = currentData.some(item => 
                (item.partId || `${item.district}_${item.state}`) === key
              );
              
              if (!exists) {
                this.delta.records.push({
                  operation: 'deleted',
                  type: dataType,
                  state: state,
                  file: fileName,
                  timestamp: new Date().toISOString(),
                  record: prevItem,
                  previous: null
                });
                
                this.delta.metadata.changes[dataType].deleted++;
              }
            });
          }
        } else {
          // Single object (like census)
          if (!previousData || JSON.stringify(previousData) !== JSON.stringify(currentData)) {
            this.delta.records.push({
              operation: changeType,
              type: dataType,
              state: state,
              file: fileName,
              timestamp: new Date().toISOString(),
              record: currentData,
              previous: changeType === 'modified' ? previousData : null
            });
            
            this.delta.metadata.changes[dataType][changeType]++;
          }
        }
      } else if (dataType === 'election-mla' || dataType === 'election-mp') {
        // Election data with nested results
        if (!previousData || JSON.stringify(previousData) !== JSON.stringify(currentData)) {
          // For elections, track the entire constituency data as one record
          this.delta.records.push({
            operation: changeType,
            type: dataType,
            state: state,
            file: fileName,
            constituency: currentData.constituency,
            timestamp: new Date().toISOString(),
            record: currentData,
            previous: changeType === 'modified' ? previousData : null
          });
          
          this.delta.metadata.changes[dataType][changeType]++;
        }
      }
      
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
    }
  }

  async saveDelta() {
    const outputDir = path.join(process.cwd(), 'dist');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save as JSONL (one record per line for streaming)
    const jsonlPath = path.join(outputDir, 'delta.jsonl');
    const jsonlContent = [
      JSON.stringify({ type: 'metadata', ...this.delta.metadata }),
      ...this.delta.records.map(r => JSON.stringify({ type: 'record', ...r }))
    ].join('\n');
    
    await fs.writeFile(jsonlPath, jsonlContent);
    
    // Also save as regular JSON for convenience
    const jsonPath = path.join(outputDir, 'delta.json');
    await fs.writeFile(jsonPath, JSON.stringify(this.delta, null, 2));
    
    // Create a changelog summary
    const changelogPath = path.join(outputDir, 'DELTA_CHANGELOG.md');
    const changelog = this.generateChangelog();
    await fs.writeFile(changelogPath, changelog);
    
    // Create consumer examples
    await this.createConsumerExamples();
    
    console.log(`\n✅ Unified delta created successfully!`);
    console.log(`Files created:`);
    console.log(`  - delta.jsonl (streaming format)`);
    console.log(`  - delta.json (structured format)`);
    console.log(`  - DELTA_CHANGELOG.md (human-readable)`);
    console.log(`  - delta-consumers/ (import examples)`);
    
    // Print summary
    console.log(`\nChanges summary:`);
    for (const [type, changes] of Object.entries(this.delta.metadata.changes)) {
      const total = changes.added + changes.modified + changes.deleted;
      if (total > 0) {
        console.log(`  ${type}: +${changes.added} ~${changes.modified} -${changes.deleted}`);
      }
    }
  }

  generateChangelog() {
    const { metadata, records } = this.delta;
    
    let changelog = `# Delta Changelog

**Version**: ${metadata.version}
**Generated**: ${metadata.generated_at}
**Format Version**: ${metadata.format_version}

## Summary

`;
    
    // Summary table
    changelog += `| Data Type | Added | Modified | Deleted | Total |
|-----------|-------|----------|---------|-------|
`;
    
    for (const [type, changes] of Object.entries(metadata.changes)) {
      const total = changes.added + changes.modified + changes.deleted;
      if (total > 0) {
        changelog += `| ${type} | ${changes.added} | ${changes.modified} | ${changes.deleted} | ${total} |\n`;
      }
    }
    
    // Detailed changes by type
    changelog += `\n## Detailed Changes\n\n`;
    
    const changesByType = {};
    records.forEach(record => {
      if (!changesByType[record.type]) {
        changesByType[record.type] = [];
      }
      changesByType[record.type].push(record);
    });
    
    for (const [type, typeRecords] of Object.entries(changesByType)) {
      changelog += `### ${type}\n\n`;
      
      const byOperation = {
        added: typeRecords.filter(r => r.operation === 'added'),
        modified: typeRecords.filter(r => r.operation === 'modified'),
        deleted: typeRecords.filter(r => r.operation === 'deleted')
      };
      
      for (const [op, opRecords] of Object.entries(byOperation)) {
        if (opRecords.length > 0) {
          changelog += `**${op.charAt(0).toUpperCase() + op.slice(1)}** (${opRecords.length}):\n`;
          opRecords.slice(0, 10).forEach(record => {
            const identifier = record.file || record.constituency || 'unknown';
            changelog += `- ${record.state}/${identifier}\n`;
          });
          if (opRecords.length > 10) {
            changelog += `- ... and ${opRecords.length - 10} more\n`;
          }
          changelog += '\n';
        }
      }
    }
    
    return changelog;
  }

  async createConsumerExamples() {
    const outputDir = path.join(process.cwd(), 'dist', 'delta-consumers');
    await fs.mkdir(outputDir, { recursive: true });
    
    // SQLite consumer
    const sqliteConsumer = `#!/usr/bin/env node
// SQLite Delta Consumer
// Usage: node sqlite-consumer.js delta.jsonl politic-data.db

const Database = require('better-sqlite3');
const fs = require('fs');
const readline = require('readline');

async function importDelta(deltaFile, dbFile) {
  const db = new Database(dbFile);
  
  const rl = readline.createInterface({
    input: fs.createReadStream(deltaFile),
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    const entry = JSON.parse(line);
    
    if (entry.type === 'metadata') {
      console.log(\`Processing delta version \${entry.version}\`);
      continue;
    }
    
    if (entry.type === 'record') {
      const { operation, type: dataType, record } = entry;
      
      switch (dataType) {
        case 'booth':
          if (operation === 'deleted') {
            db.prepare('DELETE FROM booth WHERE part_id = ?').run(record.partId);
          } else {
            db.prepare(\`
              INSERT OR REPLACE INTO booth (part_id, state_name, district_name, ac_name, part_number, part_name)
              VALUES (?, ?, ?, ?, ?, ?)
            \`).run(record.partId, record.stateName, record.districtName, record.acName, record.partNumber, record.partName);
          }
          break;
        // Add other data types...
      }
    }
  }
  
  db.close();
  console.log('Delta import complete');
}

importDelta(process.argv[2], process.argv[3]);
`;
    await fs.writeFile(path.join(outputDir, 'sqlite-consumer.js'), sqliteConsumer);
    
    // Elasticsearch consumer
    const elasticsearchConsumer = `#!/usr/bin/env python3
# Elasticsearch Delta Consumer
# Usage: python es-consumer.py delta.jsonl

import json
import sys
from elasticsearch import Elasticsearch, helpers

def import_delta(delta_file, es_host='localhost:9200'):
    es = Elasticsearch([es_host])
    
    with open(delta_file, 'r') as f:
        actions = []
        
        for line in f:
            entry = json.loads(line)
            
            if entry['type'] == 'metadata':
                print(f"Processing delta version {entry['version']}")
                continue
            
            if entry['type'] == 'record':
                operation = entry['operation']
                data_type = entry['type']
                record = entry['record']
                
                index_name = f"politic-{data_type.replace('-', '_')}"
                
                if operation == 'deleted':
                    # Generate ID based on record
                    doc_id = record.get('partId') or f"{record.get('state')}_{record.get('constituency')}"
                    actions.append({
                        '_op_type': 'delete',
                        '_index': index_name,
                        '_id': doc_id
                    })
                else:
                    # Index or update
                    doc_id = record.get('partId') or f"{record.get('state')}_{record.get('constituency')}"
                    actions.append({
                        '_op_type': 'index',
                        '_index': index_name,
                        '_id': doc_id,
                        '_source': record
                    })
                
                # Bulk insert every 100 records
                if len(actions) >= 100:
                    helpers.bulk(es, actions)
                    actions = []
        
        # Insert remaining
        if actions:
            helpers.bulk(es, actions)
    
    print("Delta import complete")

if __name__ == '__main__':
    import_delta(sys.argv[1])
`;
    await fs.writeFile(path.join(outputDir, 'es-consumer.py'), elasticsearchConsumer);
    
    // Neo4j consumer
    const neo4jConsumer = `#!/usr/bin/env python3
# Neo4j Delta Consumer
# Usage: python neo4j-consumer.py delta.jsonl

import json
import sys
from neo4j import GraphDatabase

class DeltaImporter:
    def __init__(self, uri="bolt://localhost:7687", user="neo4j", password="password"):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def close(self):
        self.driver.close()
    
    def import_delta(self, delta_file):
        with self.driver.session() as session:
            with open(delta_file, 'r') as f:
                for line in f:
                    entry = json.loads(line)
                    
                    if entry['type'] == 'metadata':
                        print(f"Processing delta version {entry['version']}")
                        continue
                    
                    if entry['type'] == 'record':
                        self.process_record(session, entry)
    
    def process_record(self, session, entry):
        operation = entry['operation']
        data_type = entry['type']
        record = entry['record']
        
        if data_type == 'booth':
            if operation == 'deleted':
                session.run("MATCH (b:Booth {partId: $partId}) DELETE b",
                           partId=record['partId'])
            else:
                session.run("""
                    MERGE (b:Booth {partId: $partId})
                    SET b.partName = $partName,
                        b.stateName = $stateName,
                        b.districtName = $districtName,
                        b.acName = $acName
                """, **record)
        # Add other data types...

if __name__ == '__main__':
    importer = DeltaImporter()
    importer.import_delta(sys.argv[1])
    importer.close()
`;
    await fs.writeFile(path.join(outputDir, 'neo4j-consumer.py'), neo4jConsumer);
    
    // Generic JSON consumer
    const jsonConsumer = `#!/usr/bin/env node
// Generic JSON Delta Consumer
// Demonstrates how to parse and process delta records

const fs = require('fs');
const readline = require('readline');

async function processDelta(deltaFile) {
  const rl = readline.createInterface({
    input: fs.createReadStream(deltaFile),
    crlfDelay: Infinity
  });
  
  const stats = {
    total: 0,
    byType: {},
    byOperation: {}
  };
  
  for await (const line of rl) {
    const entry = JSON.parse(line);
    
    if (entry.type === 'metadata') {
      console.log('Delta Metadata:', entry);
      continue;
    }
    
    if (entry.type === 'record') {
      stats.total++;
      
      // Track by data type
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
      
      // Track by operation
      stats.byOperation[entry.operation] = (stats.byOperation[entry.operation] || 0) + 1;
      
      // Process record based on your needs
      processRecord(entry);
    }
  }
  
  console.log('Processing complete. Stats:', stats);
}

function processRecord(entry) {
  const { operation, type, state, record, previous } = entry;
  
  // Your custom processing logic here
  switch (type) {
    case 'booth':
      // Handle booth records
      break;
    case 'census':
      // Handle census records
      break;
    case 'election-mla':
    case 'election-mp':
      // Handle election records
      break;
  }
}

processDelta(process.argv[2] || 'delta.jsonl');
`;
    await fs.writeFile(path.join(outputDir, 'generic-consumer.js'), jsonConsumer);
    
    // README for consumers
    const readme = `# Delta Consumer Examples

These examples show how to consume the unified delta format and import into various databases.

## Format

The delta file is in JSONL format with two types of entries:

1. **Metadata line** (first line):
\`\`\`json
{
  "type": "metadata",
  "version": "2024-01-15",
  "format_version": "1.0",
  "changes": {...}
}
\`\`\`

2. **Record lines**:
\`\`\`json
{
  "type": "record",
  "operation": "added|modified|deleted",
  "type": "booth|census|election-mla|election-mp",
  "state": "state_name",
  "file": "file_name",
  "record": {...},
  "previous": {...}  // Only for modified records
}
\`\`\`

## Usage Examples

### SQLite
\`\`\`bash
node sqlite-consumer.js ../delta.jsonl /path/to/database.db
\`\`\`

### Elasticsearch
\`\`\`bash
pip install elasticsearch
python es-consumer.py ../delta.jsonl
\`\`\`

### Neo4j
\`\`\`bash
pip install neo4j
python neo4j-consumer.py ../delta.jsonl
\`\`\`

### Generic Processing
\`\`\`bash
node generic-consumer.js ../delta.jsonl
\`\`\`

## Writing Your Own Consumer

1. Read the JSONL file line by line
2. Parse each line as JSON
3. Check the "type" field:
   - "metadata": Contains version and summary info
   - "record": Contains actual data changes
4. For records, check the "operation" field:
   - "added": New record
   - "modified": Updated record (previous value in "previous" field)
   - "deleted": Removed record
5. Process according to your database requirements
`;
    await fs.writeFile(path.join(outputDir, 'README.md'), readme);
  }

  async build() {
    try {
      console.log('Building unified delta...');
      
      // Get changed files
      const changedFiles = await this.getChangedFiles();
      
      if (changedFiles.length === 0) {
        console.log('No changes detected');
        return;
      }
      
      console.log(`Processing ${changedFiles.length} changed files...`);
      
      // Process each changed file
      for (const file of changedFiles) {
        await this.processFile(file);
      }
      
      // Save delta files
      await this.saveDelta();
      
    } catch (error) {
      console.error('Error building delta:', error);
      process.exit(1);
    }
  }
}

// Run the builder
if (require.main === module) {
  const builder = new UnifiedDeltaBuilder();
  builder.build();
}

module.exports = UnifiedDeltaBuilder;