const fs = require('fs');
const path = require('path');

const folderPath = './'; // folder containing A.csv, B.csv, etc.
const outputFile = 'dictionary.csv';

let mergedContent = '';

for (let i = 65; i <= 90; i++) { // ASCII A-Z
    const fileName = String.fromCharCode(i) + '.csv';
    const filePath = path.join(folderPath, fileName);

    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (content) {
            mergedContent += content + '\n';
        }
    } else {
        console.warn(`Skipping missing file: ${fileName}`);
    }
}

fs.writeFileSync(outputFile, mergedContent.trim(), 'utf8');
console.log(`✅ Merged CSV saved as ${outputFile}`);