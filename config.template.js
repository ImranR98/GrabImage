// Create a copy of this file, rename it 'config.js', and set the below variables as needed
// A valid config.js is needed for the App to run

module.exports.config = {
    queriesFilePath: '/home/user/Downloads/ISBNs.txt',
    outputImagesDir: '/home/user/Downloads/ISBNImages',
    minutesDelay: 5, // A delay (5 minutes by default) is needed between each query to avoid rate limiting (Google WILL BAN your IP if you send requests too often; experiment at your own risk)
    msWait: 5000, // How long to wait for an image to load (initial thumbnail and hi res version are treated as 2 images)
    skipExisting: true, // Skip a query if an image for it is found to already exist
    randomizeDelay: true // Whether to randomize the delay (between 50% and 100% of minutesDelay)
}