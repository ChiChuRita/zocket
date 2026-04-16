import { execSync } from 'child_process';
import { chdir } from 'process';

try {
  chdir('/vercel/share/v0-project');
  const output = execSync('git pull origin main', { encoding: 'utf-8' });
  console.log(output);
} catch (error) {
  console.error('Error pulling latest:', error.message);
}
