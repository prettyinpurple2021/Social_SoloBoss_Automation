#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findImportsInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = new Set();
    
    // Match ES6 imports
    const es6ImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6ImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        // Extract package name (handle scoped packages)
        const packageName = importPath.startsWith('@') 
          ? importPath.split('/').slice(0, 2).join('/')
          : importPath.split('/')[0];
        imports.add(packageName);
      }
    }
    
    // Match CommonJS requires
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        const packageName = importPath.startsWith('@') 
          ? importPath.split('/').slice(0, 2).join('/')
          : importPath.split('/')[0];
        imports.add(packageName);
      }
    }
    
    return imports;
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
    return new Set();
  }
}

function findAllFiles(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const files = [];
  
  function traverse(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and dist directories
          if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
            traverse(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${currentDir}: ${error.message}`);
    }
  }
  
  traverse(dir);
  return files;
}

function analyzePackage(packageDir) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`No package.json found in ${packageDir}`);
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  console.log(`\n📦 Analyzing ${packageJson.name || path.basename(packageDir)}`);
  console.log(`   Location: ${packageDir}`);
  
  // Find all source files
  const srcDir = path.join(packageDir, 'src');
  const files = fs.existsSync(srcDir) 
    ? findAllFiles(srcDir)
    : findAllFiles(packageDir, ['.ts', '.tsx', '.js', '.jsx']);
  
  // Also check config files in the package root
  const configFiles = [
    'vite.config.ts',
    'vitest.config.ts',
    'jest.config.js',
    'webpack.config.js',
    'rollup.config.js'
  ].map(file => path.join(packageDir, file))
   .filter(file => fs.existsSync(file));
  
  files.push(...configFiles);
  
  console.log(`   Found ${files.length} files to analyze`);
  
  // Collect all imports
  const usedPackages = new Set();
  for (const file of files) {
    const imports = findImportsInFile(file);
    imports.forEach(pkg => usedPackages.add(pkg));
  }
  
  // Find unused dependencies
  const unusedDeps = [];
  const usedDeps = [];
  
  for (const [depName, version] of Object.entries(dependencies)) {
    // Skip certain packages that are used indirectly
    const skipPackages = [
      '@types/node',
      'typescript',
      'ts-node',
      'nodemon',
      '@typescript-eslint/eslint-plugin',
      '@typescript-eslint/parser',
      'eslint',
      'prettier',
      'jest',
      'vitest',
      '@vitejs/plugin-react',
      'vite',
      'concurrently'
    ];
    
    if (skipPackages.includes(depName)) {
      continue;
    }
    
    if (usedPackages.has(depName)) {
      usedDeps.push(depName);
    } else {
      unusedDeps.push({ name: depName, version });
    }
  }
  
  console.log(`   ✅ Used dependencies (${usedDeps.length}): ${usedDeps.join(', ')}`);
  
  if (unusedDeps.length > 0) {
    console.log(`   ⚠️  Potentially unused dependencies (${unusedDeps.length}):`);
    unusedDeps.forEach(dep => {
      console.log(`      - ${dep.name}@${dep.version}`);
    });
  } else {
    console.log(`   ✅ No unused dependencies found`);
  }
  
  return { used: usedDeps, unused: unusedDeps };
}

// Main execution
const workspaceRoot = process.cwd();
const packagesDir = path.join(workspaceRoot, 'packages');

console.log('🔍 Analyzing dependencies for unused packages...\n');

// Analyze root package
console.log('📦 Root Package');
analyzePackage(workspaceRoot);

// Analyze workspace packages
if (fs.existsSync(packagesDir)) {
  const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(packagesDir, entry.name));
  
  for (const packageDir of packages) {
    analyzePackage(packageDir);
  }
}

console.log('\n✅ Dependency analysis complete!');
console.log('\nNote: Some dependencies might be used indirectly or in configuration files not analyzed.');
console.log('Please review the results carefully before removing any dependencies.');