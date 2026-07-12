const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function replaceInFiles(dir) {
  const files = execSync(`find "${dir}" -type f -name "*.ts" -o -name "*.tsx" -o -name "*.json"`).toString().split('\n').filter(Boolean);
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Emojis to remove
    const emojis = /🚀|💎|✨|🎉|⭐|🔥|💡|🎯|📄|📃|🏆|🌟|💫|🎊|🔔|💰|📱|💼|📊|✓/g;
    content = content.replace(emojis, '');

    // Branding
    content = content.replace(/InvoiceStudio/g, 'VELA');
    content = content.replace(/Invoice Studio/g, 'VELA');
    content = content.replace(/invoicestudio/g, 'vela');

    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log(`Cleaned ${file}`);
    }
  }
}

replaceInFiles(path.join(__dirname, '..', 'app'));
replaceInFiles(path.join(__dirname, '..', 'components'));
replaceInFiles(path.join(__dirname, '..', 'lib'));
replaceInFiles(path.join(__dirname, '..')); // for package.json
