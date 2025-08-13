#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Export vector embeddings to Neo4j format
 * Generates Cypher queries for importing data with vector indexes
 */

class Neo4jExporter {
  constructor() {
    this.cypherStatements = [];
    this.constraints = [];
    this.indexes = [];
  }

  async loadVectorData() {
    const vectorPath = path.join(process.cwd(), 'dist', 'politic-data-vectors.json');
    const content = await fs.readFile(vectorPath, 'utf-8');
    return JSON.parse(content);
  }

  generateConstraints() {
    // Create uniqueness constraints
    this.constraints.push(
      'CREATE CONSTRAINT booth_id IF NOT EXISTS FOR (b:Booth) REQUIRE b.id IS UNIQUE;',
      'CREATE CONSTRAINT census_id IF NOT EXISTS FOR (c:Census) REQUIRE c.id IS UNIQUE;',
      'CREATE CONSTRAINT election_mla_id IF NOT EXISTS FOR (e:ElectionMLA) REQUIRE e.id IS UNIQUE;',
      'CREATE CONSTRAINT election_mp_id IF NOT EXISTS FOR (e:ElectionMP) REQUIRE e.id IS UNIQUE;',
      'CREATE CONSTRAINT state_name IF NOT EXISTS FOR (s:State) REQUIRE s.name IS UNIQUE;',
      'CREATE CONSTRAINT district_name_state IF NOT EXISTS FOR (d:District) REQUIRE (d.name, d.state) IS UNIQUE;',
      'CREATE CONSTRAINT constituency_name_state IF NOT EXISTS FOR (c:Constituency) REQUIRE (c.name, c.state, c.type) IS UNIQUE;',
      'CREATE CONSTRAINT party_name IF NOT EXISTS FOR (p:Party) REQUIRE p.name IS UNIQUE;',
      'CREATE CONSTRAINT candidate_id IF NOT EXISTS FOR (c:Candidate) REQUIRE c.id IS UNIQUE;'
    );
  }

  generateVectorIndexes() {
    // Create vector indexes for similarity search
    this.indexes.push(
      // Neo4j 5.11+ vector index syntax
      `CREATE VECTOR INDEX booth_embeddings IF NOT EXISTS
       FOR (n:Booth) ON (n.embedding)
       OPTIONS {indexConfig: {
         \`vector.dimensions\`: 384,
         \`vector.similarity_function\`: 'cosine'
       }};`,
      
      `CREATE VECTOR INDEX census_embeddings IF NOT EXISTS
       FOR (n:Census) ON (n.embedding)
       OPTIONS {indexConfig: {
         \`vector.dimensions\`: 384,
         \`vector.similarity_function\`: 'cosine'
       }};`,
      
      `CREATE VECTOR INDEX election_mla_embeddings IF NOT EXISTS
       FOR (n:ElectionMLA) ON (n.embedding)
       OPTIONS {indexConfig: {
         \`vector.dimensions\`: 384,
         \`vector.similarity_function\`: 'cosine'
       }};`,
      
      `CREATE VECTOR INDEX election_mp_embeddings IF NOT EXISTS
       FOR (n:ElectionMP) ON (n.embedding)
       OPTIONS {indexConfig: {
         \`vector.dimensions\`: 384,
         \`vector.similarity_function\`: 'cosine'
       }};`
    );
  }

  escapeString(str) {
    if (!str) return null;
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  generateBoothCypher(entity) {
    const { id, text, embedding, metadata } = entity;
    
    // Create state node
    this.cypherStatements.push(
      `MERGE (s:State {name: '${this.escapeString(metadata.stateName)}'})
       SET s.code = '${metadata.stateCode}';`
    );
    
    // Create district node
    this.cypherStatements.push(
      `MERGE (d:District {name: '${this.escapeString(metadata.districtName)}', state: '${this.escapeString(metadata.stateName)}'})
       SET d.code = '${metadata.districtCode}';`
    );
    
    // Create constituency node
    this.cypherStatements.push(
      `MERGE (c:Constituency {name: '${this.escapeString(metadata.acName)}', state: '${this.escapeString(metadata.stateName)}', type: 'VIDHAN_SABHA'})
       SET c.number = ${metadata.acNumber};`
    );
    
    // Create booth node with embedding
    this.cypherStatements.push(
      `CREATE (b:Booth {
         id: '${id}',
         partId: ${metadata.partId},
         partNumber: ${metadata.partNumber},
         partName: '${this.escapeString(metadata.partName)}',
         text: '${this.escapeString(text)}',
         embedding: [${embedding.join(',')}]
       });`
    );
    
    // Create relationships
    this.cypherStatements.push(
      `MATCH (b:Booth {id: '${id}'}),
              (c:Constituency {name: '${this.escapeString(metadata.acName)}', state: '${this.escapeString(metadata.stateName)}', type: 'VIDHAN_SABHA'}),
              (d:District {name: '${this.escapeString(metadata.districtName)}', state: '${this.escapeString(metadata.stateName)}'}),
              (s:State {name: '${this.escapeString(metadata.stateName)}'})
       CREATE (b)-[:LOCATED_IN]->(c)
       CREATE (c)-[:PART_OF]->(d)
       CREATE (d)-[:IN_STATE]->(s);`
    );
  }

  generateCensusCypher(entity) {
    const { id, text, embedding, metadata } = entity;
    
    // Create census node with embedding
    this.cypherStatements.push(
      `MERGE (c:Census {id: '${id}'})
       SET c.district = '${this.escapeString(metadata.district)}',
           c.state = '${this.escapeString(metadata.state)}',
           c.census_year = ${metadata.census_year},
           c.total_population = ${metadata.total_population},
           c.male_population = ${metadata.male_population},
           c.female_population = ${metadata.female_population},
           c.sex_ratio = ${metadata.sex_ratio},
           c.urban_percentage = ${metadata.urban_percentage},
           c.literacy_rate = ${metadata.literacy_rate},
           c.text = '${this.escapeString(text)}',
           c.embedding = [${embedding.join(',')}];`
    );
    
    // Link to district
    this.cypherStatements.push(
      `MATCH (c:Census {id: '${id}'}),
              (d:District {name: '${this.escapeString(metadata.district)}', state: '${this.escapeString(metadata.state)}'})
       CREATE (c)-[:CENSUS_OF]->(d);`
    );
  }

  generateElectionMLACypher(entity) {
    const { id, text, embedding, metadata } = entity;
    
    // Create party node
    this.cypherStatements.push(
      `MERGE (p:Party {name: '${this.escapeString(metadata.party)}'});`
    );
    
    // Create candidate node
    const candidateId = `candidate_${metadata.candidate_name}_${metadata.party}`.replace(/\s+/g, '_');
    this.cypherStatements.push(
      `MERGE (cand:Candidate {id: '${candidateId}'})
       SET cand.name = '${this.escapeString(metadata.candidate_name)}';`
    );
    
    // Create election result node with embedding
    this.cypherStatements.push(
      `CREATE (e:ElectionMLA {
         id: '${id}',
         state: '${this.escapeString(metadata.state)}',
         constituency: '${this.escapeString(metadata.constituency)}',
         ac_type: '${metadata.ac_type || 'GEN'}',
         year: ${metadata.year},
         position: ${metadata.position},
         votes: ${metadata.votes},
         votes_percentage: ${metadata.votes_percentage || 0},
         text: '${this.escapeString(text)}',
         embedding: [${embedding.join(',')}]
       });`
    );
    
    // Create relationships
    this.cypherStatements.push(
      `MATCH (e:ElectionMLA {id: '${id}'}),
              (cand:Candidate {id: '${candidateId}'}),
              (p:Party {name: '${this.escapeString(metadata.party)}'})
       CREATE (e)-[:CONTESTED_BY]->(cand)
       CREATE (e)-[:REPRESENTED_BY]->(p)
       CREATE (cand)-[:AFFILIATED_WITH]->(p);`
    );
    
    // Link to constituency
    this.cypherStatements.push(
      `MATCH (e:ElectionMLA {id: '${id}'}),
              (c:Constituency {name: '${this.escapeString(metadata.constituency)}', state: '${this.escapeString(metadata.state)}', type: 'VIDHAN_SABHA'})
       CREATE (e)-[:IN_CONSTITUENCY]->(c);`
    );
  }

  generateElectionMPCypher(entity) {
    const { id, text, embedding, metadata } = entity;
    
    // Create party node
    this.cypherStatements.push(
      `MERGE (p:Party {name: '${this.escapeString(metadata.party)}'});`
    );
    
    // Create candidate node
    const candidateId = `candidate_${metadata.candidate_name}_${metadata.party}`.replace(/\s+/g, '_');
    this.cypherStatements.push(
      `MERGE (cand:Candidate {id: '${candidateId}'})
       SET cand.name = '${this.escapeString(metadata.candidate_name)}';`
    );
    
    // Create election result node with embedding
    this.cypherStatements.push(
      `CREATE (e:ElectionMP {
         id: '${id}',
         state: '${this.escapeString(metadata.state)}',
         constituency: '${this.escapeString(metadata.constituency)}',
         pc_type: '${metadata.pc_type || 'GEN'}',
         year: ${metadata.year},
         position: ${metadata.position},
         votes: ${metadata.votes},
         votes_percentage: ${metadata.votes_percentage || 0},
         text: '${this.escapeString(text)}',
         embedding: [${embedding.join(',')}]
       });`
    );
    
    // Create relationships
    this.cypherStatements.push(
      `MATCH (e:ElectionMP {id: '${id}'}),
              (cand:Candidate {id: '${candidateId}'}),
              (p:Party {name: '${this.escapeString(metadata.party)}'})
       CREATE (e)-[:CONTESTED_BY]->(cand)
       CREATE (e)-[:REPRESENTED_BY]->(p)
       CREATE (cand)-[:AFFILIATED_WITH]->(p);`
    );
    
    // Link to constituency
    this.cypherStatements.push(
      `MATCH (e:ElectionMP {id: '${id}'}),
              (c:Constituency)
       WHERE c.name = '${this.escapeString(metadata.constituency)}' 
         AND c.state = '${this.escapeString(metadata.state)}'
         AND c.type = 'LOK_SABHA'
       CREATE (e)-[:IN_CONSTITUENCY]->(c);`
    );
  }

  async export() {
    try {
      console.log('Loading vector data...');
      const vectorData = await this.loadVectorData();
      
      console.log('Generating Neo4j constraints and indexes...');
      this.generateConstraints();
      this.generateVectorIndexes();
      
      console.log('Generating Cypher statements...');
      let boothCount = 0, censusCount = 0, mlaCount = 0, mpCount = 0;
      
      for (const entity of vectorData.entities) {
        switch (entity.type) {
          case 'booth':
            this.generateBoothCypher(entity);
            boothCount++;
            break;
          case 'census':
            this.generateCensusCypher(entity);
            censusCount++;
            break;
          case 'election_mla':
            this.generateElectionMLACypher(entity);
            mlaCount++;
            break;
          case 'election_mp':
            this.generateElectionMPCypher(entity);
            mpCount++;
            break;
        }
      }
      
      // Save Cypher script
      const outputDir = path.join(process.cwd(), 'dist');
      await fs.mkdir(outputDir, { recursive: true });
      
      const cypherPath = path.join(outputDir, 'politic-data-neo4j.cypher');
      const cypherContent = [
        '// Indian Political Data - Neo4j Import Script',
        `// Generated: ${new Date().toISOString()}`,
        `// Total Entities: ${vectorData.entities.length}`,
        `// Embedding Dimension: ${vectorData.metadata.dimension}`,
        '',
        '// Create Constraints',
        ...this.constraints,
        '',
        '// Create Vector Indexes',
        ...this.indexes,
        '',
        '// Import Data',
        ...this.cypherStatements
      ].join('\n');
      
      await fs.writeFile(cypherPath, cypherContent);
      console.log(`\n✅ Neo4j export complete!`);
      console.log(`Cypher script saved to: ${cypherPath}`);
      console.log(`Entities exported:`);
      console.log(`  - Booth: ${boothCount}`);
      console.log(`  - Census: ${censusCount}`);
      console.log(`  - Election MLA: ${mlaCount}`);
      console.log(`  - Election MP: ${mpCount}`);
      
      // Create import instructions
      const instructionsPath = path.join(outputDir, 'neo4j-import-instructions.md');
      const instructions = `# Neo4j Import Instructions

## Prerequisites
- Neo4j 5.11+ (with vector index support)
- Neo4j APOC plugin (optional but recommended)

## Import Steps

1. **Start Neo4j Database**
   \`\`\`bash
   neo4j start
   \`\`\`

2. **Import using cypher-shell**
   \`\`\`bash
   cat politic-data-neo4j.cypher | cypher-shell -u neo4j -p your-password
   \`\`\`

3. **Or import via Neo4j Browser**
   - Open Neo4j Browser
   - Copy contents of \`politic-data-neo4j.cypher\`
   - Paste and execute in batches

## Vector Search Queries

### Find similar constituencies
\`\`\`cypher
MATCH (b:Booth {partName: "PRATHMIC SCHOOL PARMAT ROOM NO. 1"})
CALL db.index.vector.queryNodes('booth_embeddings', 10, b.embedding)
YIELD node, score
RETURN node.partName, node.text, score
ORDER BY score DESC
\`\`\`

### Find demographically similar districts
\`\`\`cypher
MATCH (c:Census {district: "Chennai"})
CALL db.index.vector.queryNodes('census_embeddings', 5, c.embedding)
YIELD node, score
RETURN node.district, node.state, node.total_population, score
ORDER BY score DESC
\`\`\`

### Find election patterns
\`\`\`cypher
MATCH (e:ElectionMLA {constituency: "Chennai Central", year: 2021})
CALL db.index.vector.queryNodes('election_mla_embeddings', 10, e.embedding)
YIELD node, score
RETURN node.constituency, node.year, node.state, score
ORDER BY score DESC
\`\`\`

## Performance Optimization

1. **Batch Import**: For large datasets, use \`neo4j-admin import\` instead
2. **Memory Settings**: Increase heap size in \`neo4j.conf\`
3. **Index Creation**: Create indexes after data import for better performance
`;
      
      await fs.writeFile(instructionsPath, instructions);
      console.log(`Import instructions saved to: ${instructionsPath}`);
      
    } catch (error) {
      console.error('Error exporting to Neo4j:', error);
      process.exit(1);
    }
  }
}

// Run the exporter
if (require.main === module) {
  const exporter = new Neo4jExporter();
  exporter.export();
}

module.exports = Neo4jExporter;