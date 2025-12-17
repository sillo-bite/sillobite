const { exec } = require('child_process');
const path = require('path');

// Run the migration using ts-node
const migrationPath = path.join(__dirname, 'migrations', 'migrate-payments-canteen.ts');

exec(`npx ts-node "${migrationPath}"`, (error, stdout, stderr) => {
  if (error) {
    console.error('Migration failed:', error);
    return;
  }
  
  if (stderr) {
    console.error('Migration stderr:', stderr);
  }
  
  console.log('Migration output:', stdout);
});






