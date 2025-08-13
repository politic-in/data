#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

const SCHEMA_MAP = {
  'booth': path.join(__dirname, '..', 'schemas', 'booth.schema.json'),
  'census': path.join(__dirname, '..', 'schemas', 'census.schema.json'),
  'election-mla': path.join(__dirname, '..', 'schemas', 'election-mla.schema.json'),
  'election-mp': path.join(__dirname, '..', 'schemas', 'election-mp.schema.json')
};

async function loadSchema(schemaPath) {
  try {
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    return JSON.parse(schemaContent);
  } catch (error) {
    console.error(`Error loading schema from ${schemaPath}:`, error.message);
    process.exit(1);
  }
}

async function validateFile(filePath, validator) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    const valid = validator(data);
    
    if (!valid) {
      return {
        file: filePath,
        valid: false,
        errors: validator.errors
      };
    }
    
    return {
      file: filePath,
      valid: true
    };
  } catch (error) {
    return {
      file: filePath,
      valid: false,
      errors: [{ message: `Parse error: ${error.message}` }]
    };
  }
}

async function validateDataType(dataType) {
  const schemaPath = SCHEMA_MAP[dataType];
  if (!schemaPath) {
    console.error(`Unknown data type: ${dataType}`);
    console.error(`Available types: ${Object.keys(SCHEMA_MAP).join(', ')}`);
    return false;
  }

  console.log(`\nValidating ${dataType} files...`);
  console.log(`Using schema: ${schemaPath}`);
  
  const schema = await loadSchema(schemaPath);
  const validator = ajv.compile(schema);
  
  const pattern = dataType === 'booth' 
    ? `${dataType}/**/*.json`
    : `${dataType}/**/*.json`;
  
  const files = await glob(pattern, { cwd: process.cwd() });
  
  if (files.length === 0) {
    console.log(`No ${dataType} JSON files found`);
    return true;
  }
  
  console.log(`Found ${files.length} files to validate`);
  
  let hasErrors = false;
  const results = [];
  
  for (const file of files) {
    const result = await validateFile(file, validator);
    results.push(result);
    
    if (!result.valid) {
      hasErrors = true;
      console.error(`\n❌ Invalid: ${result.file}`);
      if (result.errors) {
        result.errors.forEach(error => {
          if (error.instancePath) {
            console.error(`  - ${error.instancePath}: ${error.message}`);
          } else {
            console.error(`  - ${error.message}`);
          }
          if (error.params) {
            console.error(`    Parameters: ${JSON.stringify(error.params)}`);
          }
        });
      }
    }
  }
  
  const validCount = results.filter(r => r.valid).length;
  const invalidCount = results.filter(r => !r.valid).length;
  
  console.log(`\n${dataType} Summary:`);
  console.log(`  ✅ Valid files: ${validCount}`);
  console.log(`  ❌ Invalid files: ${invalidCount}`);
  
  return !hasErrors;
}

async function main() {
  const args = process.argv.slice(2);
  let dataTypes = args.length > 0 ? args : Object.keys(SCHEMA_MAP);
  
  if (process.env.VALIDATE_TYPES) {
    dataTypes = process.env.VALIDATE_TYPES.split(',').map(t => t.trim());
  }
  
  console.log('JSON Schema Validator for Political Data');
  console.log('========================================');
  
  let allValid = true;
  
  for (const dataType of dataTypes) {
    const isValid = await validateDataType(dataType);
    if (!isValid) {
      allValid = false;
    }
  }
  
  console.log('\n========================================');
  if (allValid) {
    console.log('✅ All validations passed!');
    process.exit(0);
  } else {
    console.log('❌ Validation failed! Please fix the errors above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { validateDataType, validateFile };