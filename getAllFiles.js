// Import necessary Node.js modules
const fs = require('fs'); // File System module for reading/writing files
const path = require('path'); // Path module for handling file paths
const { execSync } = require('child_process'); // Module to execute shell commands

// --- Configuration ---
const outputFileName = 'all_code.txt'; // Name of the output file
const repoPath = '.'; // Path to the git repository (current directory by default)
const filesToIgnore = ['package-lock.json']; // Files to ignore
// --- End Configuration ---

console.log('Starting script...');

try {
    // 1. Get the list of Git-tracked files
    // Executes `git ls-files` in the specified repository path
    // The output is converted to a string and trimmed of whitespace
    console.log(`Running 'git ls-files' in directory: ${path.resolve(repoPath)}`);
    const gitFilesOutput = execSync('git ls-files', { cwd: repoPath, encoding: 'utf8' }).trim();

    // Split the output string into an array of filenames and filter out ignored files
    let trackedFiles = gitFilesOutput.split('\n').filter(file => file); // Filter out empty lines

    // Filter out the files specified in filesToIgnore
    trackedFiles = trackedFiles.filter(file => !filesToIgnore.includes(path.basename(file)));

    if (trackedFiles.length === 0) {
        console.log('No tracked files found (after filtering) in the repository.');
        process.exit(0); // Exit gracefully if no files left
    }

    console.log(`Found ${trackedFiles.length} tracked files (after filtering).`);

    // 2. Read content and format
    let combinedContent = ''; // Initialize an empty string to store combined content

    trackedFiles.forEach(relativeFilePath => {
        // Construct the full path to the file
        const fullFilePath = path.join(repoPath, relativeFilePath);
        console.log(`Processing file: ${relativeFilePath}`);

        try {
            // Read the content of the current file
            const fileContent = fs.readFileSync(fullFilePath, 'utf8');

            // Add a comment header with the filename
            combinedContent += `// ---------- File: ${relativeFilePath} ----------\n\n`;
            // Append the file's content
            combinedContent += fileContent;
            // Add separators for clarity
            combinedContent += `\n\n// ---------- End of File: ${relativeFilePath} ----------\n\n`;

        } catch (readError) {
            // Log an error if a file cannot be read, but continue with others
            console.error(`Error reading file ${relativeFilePath}: ${readError.message}`);
            combinedContent += `// ---------- Error reading file: ${relativeFilePath} ----------\n\n`;
        }
    });

    // 3. Write to the output file
    const outputFilePath = path.join(repoPath, outputFileName);
    console.log(`Writing combined content to: ${outputFilePath}`);
    fs.writeFileSync(outputFilePath, combinedContent, 'utf8');

    console.log(`Successfully created ${outputFileName} with the content of ${trackedFiles.length} files.`);

} catch (error) {
    // Catch errors during git command execution or file writing
    console.error('An error occurred:', error.message);
    if (error.stderr) {
        console.error('Git Error Output:', error.stderr.toString());
    }
    process.exit(1); // Exit with an error code
}
