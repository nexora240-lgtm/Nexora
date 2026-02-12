const fs = require('fs');
const path = require('path');

// Read the project list
const projectsFile = fs.readFileSync('firebase-projects.json', 'utf8');
const { projects } = JSON.parse(projectsFile);

// Update .firebaserc
const firebaserc = {
  projects: {
    default: projects[0]
  },
  targets: {}
};

projects.forEach(projectId => {
  firebaserc.targets[projectId] = {
    hosting: {
      main: [projectId]
    }
  };
});

fs.writeFileSync('.firebaserc', JSON.stringify(firebaserc, null, 2));
console.log('✓ Updated .firebaserc');

// Update workflow file
const workflowPath = '.github/workflows/firebase-hosting-merge.yml';
let workflow = fs.readFileSync(workflowPath, 'utf8');

// Replace the matrix section
const matrixProjects = projects.map(p => `          - ${p}`).join('\n');
const newMatrix = `      matrix:
        projectId:
${matrixProjects}`;

workflow = workflow.replace(
  /      matrix:\s+projectId:\s+(- [^\n]+\n)+/s,
  newMatrix + '\n'
);

fs.writeFileSync(workflowPath, workflow);
console.log('✓ Updated firebase-hosting-merge.yml');
console.log(`\nConfigured ${projects.length} Firebase projects:`);
projects.forEach(p => console.log(`  - ${p}`));
