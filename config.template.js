// Create a copy of this file, rename it 'config.js', and set the below variables as needed
// A valid config.js is needed for the App to run

module.exports.config = {
    queriesFilePath: '/home/user/Downloads/ISBNs.txt',
    outputImagesDir: '/home/user/Downloads/ISBNImages',
    minutesDelay: 12, // A delay (12 minutes by default) is needed between each query to avoid rate limiting (Google WILL BAN your IP if you send requests too often; experiment at your own risk)
    skipExisting: true // Skip a query if an image for it is found to already exist
}