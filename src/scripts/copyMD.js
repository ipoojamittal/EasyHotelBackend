// Import necessary Node.js modules
// 'fs' (File System) for interacting with the file system
// 'path' for handling and transforming file paths
const fs = require('fs');
const path = require('path');

/**
 * Finds all .md files in the sourceDirectory, combines their content
 * into a single .txt file, prepending each section with the original filename.
 *
 * @param {string} [outputFilename="combined_markdown.txt"] - The name of the output text file.
 * @param {string} [sourceDirectory="."] - The path to the directory containing the .md files.
 */
function combineMarkdownFiles(outputFilename = "combined_markdown.txt", sourceDirectory = ".") {
    // Resolve the source directory path to ensure it's absolute or relative to the script's location as intended
    const resolvedSourceDirectory = path.resolve(sourceDirectory);

    try {
        // Get a list of all files and directories in the source directory synchronously
        const allFiles = fs.readdirSync(resolvedSourceDirectory);

        // Filter the list to get only files ending with .md
        const markdownFiles = allFiles.filter(file => {
            const filePath = path.join(resolvedSourceDirectory, file);
            try {
                // Check if it's a file and ends with .md
                return fs.statSync(filePath).isFile() && file.endsWith('.md');
            } catch (statError) {
                // Handle potential errors if a file disappears between readdir and stat
                console.warn(`Warning: Could not stat file ${filePath}: ${statError.message}`);
                return false;
            }
        });

        // Check if any markdown files were found
        if (markdownFiles.length === 0) {
            console.log(`No .md files found in '${resolvedSourceDirectory}'.`);
            return; // Exit the function if no markdown files are found
        }

        console.log(`Found ${markdownFiles.length} markdown files. Combining into '${outputFilename}'...`);

        // Create a writable stream to the output file.
        // This will overwrite the file if it already exists.
        // Use utf-8 encoding for broad compatibility.
        const outputStream = fs.createWriteStream(outputFilename, { encoding: 'utf8' });

        // Process each markdown file
        markdownFiles.forEach(filename => {
            const filepath = path.join(resolvedSourceDirectory, filename);
            console.log(`Processing: ${filename}`);

            try {
                // Write the original filename as a header
                outputStream.write(`--- Start of File: ${filename} ---\n\n`);

                // Read the content of the markdown file synchronously
                const content = fs.readFileSync(filepath, { encoding: 'utf8' });

                // Write the content to the output stream
                outputStream.write(content);

                // Add separation for clarity
                outputStream.write(`\n\n--- End of File: ${filename} ---\n\n`);

            } catch (readError) {
                console.error(`Error reading file ${filepath}: ${readError.message}`);
                // Continue to the next file even if one fails
            }
        });

        // Close the stream to ensure all data is written to the file
        outputStream.end();

        // Event listener for successful completion
        outputStream.on('finish', () => {
            console.log(`Successfully combined files from '${resolvedSourceDirectory}' into '${outputFilename}'.`);
        });

        // Event listener for errors during writing
        outputStream.on('error', (writeError) => {
            console.error(`Error writing to output file ${outputFilename}: ${writeError.message}`);
        });


    } catch (err) {
        // Handle errors like directory not found or permission issues
        if (err.code === 'ENOENT') {
            console.error(`Error: Directory not found - ${resolvedSourceDirectory}`);
        } else {
            console.error(`An error occurred while accessing directory ${resolvedSourceDirectory}: ${err.message}`);
        }
        // Optionally, exit the script if the directory cannot be accessed
        // process.exit(1);
    }
}

// --- Script Execution ---

// You can change the output filename here if needed
const customOutputFilename = "combined_curl_examples.txt";
// *** Set the source directory to doc/curl_examples ***
const customSourceDirectory = "doc/curl_examples";

// Call the function to start the process
combineMarkdownFiles(customOutputFilename, customSourceDirectory);

// Example of calling with default values (would search the current directory):
// combineMarkdownFiles();
