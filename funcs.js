const { Builder, By, Key, until } = require('selenium-webdriver')
const fs = require('fs')

// Return a promise that resolves after a specific number of milliseconds
module.exports.sleep = (ms) => new Promise((resolve, reject) => { setTimeout(() => { resolve() }, ms) })

// Create a new directory if it doesn't exist (recursively, if needed)
module.exports.mkdirIfNeeded = (dirPath) => {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
    if (!fs.statSync(dirPath).isDirectory()) throw dirPath + ' is not a directory'
}

// Change the input string to be compatible with the format of URL query strings (which also happens to be filesystem friendly)
module.exports.sanitizeQuery = (query) => {
    let safeHTMLChars = new RegExp('([A-Z]|[a-z]|[0-9]|-|_)')
    query = query.split(' ').join('+')
    let temp = ''
    for (let i = 0; i < query.length; i++) {
        if (safeHTMLChars.test(query[i])) temp += query[i]
        else temp += '+'
    }
    return temp
}

// Grab the first Google image result for the provided keyword and return it in Base64 encoding
// You can opt not to sanitize the query if you're sure it already is
module.exports.grabImage = async (query, sanitize = true) => {
    if (sanitize) query = this.sanitizeQuery(query)
    let driver = await new Builder().forBrowser('chrome').build();
    let base64Image = ''
    try {
        await driver.get('https://www.google.com/search?tbm=isch&q=' + query);
        await (await driver.findElement(By.css('img.Q4LuWd'))).click();
        await driver.wait(until.elementLocated(By.css('img.n3VNCb')), 2000);
        base64Image = await (await driver.findElement(By.css('img.n3VNCb'))).getAttribute('src')
    } finally {
        await driver.quit();
    }
    return base64Image
}

// Save a base64 encoded image to the file system
// Optionally skip ensuring the destination directory exists if you're sure it does
module.exports.saveBase64Image = (base64Image, destDir, fileName, ensureDir = true) => {
    if (ensureDir) this.mkdirIfNeeded(destDir)
    let matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    let response = {}
    if (matches.length !== 3) throw 'Invalid input string'
    response.type = matches[1];
    response.data = Buffer.from(matches[2], 'base64');
    fs.writeFileSync(destDir + '/' + fileName + '.' + response.type.split('/')[1], response.data)
}

// Read a comma (or newline, or both) separated list of queries from a file
module.exports.readQueriesFromFile = (filePath) => fs.readFileSync(filePath).toString().split('\n').join(',').split(',').map(str => str.trim()).filter(str => str != '')

// Grab and save a Google image for each of several queries
// A delay (12 minutes by default) is needed between each query to avoid rate limiting
// Google WILL BAN your IP if you send requests too often; experiment at your own risk
module.exports.grabAndSaveSeveralImages = async (queries, destDir, quiet = false, minutesDelay = 12) => {
    this.mkdirIfNeeded(destDir)
    let msDelay = minutesDelay * 60 * 1000
    queries = queries.map(query => this.sanitizeQuery(query))
    for (let i = 0; i < queries.length; i++) {
        if (!quiet) console.log((i + 1) + ' of ' + queries.length + '...')
        try {
            this.saveBase64Image(await this.grabImage(queries[i]), destDir, queries[i], false)
            if (!quiet) console.log('Saved.')
        } catch (err) {
            if (!quiet) console.error('Error: ' + err)
        }
        if (i < queries.length - 1) {
            if (!quiet) console.log('Waiting ' + minutesDelay + ' minutes...')
            await this.sleep(msDelay)
        }
    }
    if (!quiet) console.log('Done')
}