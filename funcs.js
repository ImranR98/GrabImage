const { Builder, By, Key, until, } = require('selenium-webdriver')
const fs = require('fs')
const https = require('https')
const glob = require('glob')

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

// Grab the first Google image result for the provided keyword and return it's URL
// You can opt not to sanitize the query if you're sure it already is
module.exports.grabImageURL = async (query, sanitize = true, msWait = 5000) => {
    if (sanitize) query = this.sanitizeQuery(query)
    let driver = await new Builder().forBrowser('chrome').build()
    let imageURL = ''
    try {
        await driver.get('https://www.google.com/search?tbm=isch&q=' + query)
        await (await driver.findElement(By.css('img.Q4LuWd'))).click()
        await driver.wait(until.elementLocated(By.css('img.n3VNCb')), msWait)
        let targetImage = await driver.findElement(By.css('img.n3VNCb'))
        let ms = 0
        // A low res base64 thumbnail is placed in the 'src' for a short time while the main source image loads
        // We wait for the main image by checking that the 'src' starts with 'http' (as opposed to 'data:' for a base64 data URL)
        // Like any other wait in the function, an error is thrown if we wait longer that 'msWait' milliseconds
        while (!(await targetImage.getAttribute('src')).startsWith('http') && ms < msWait) {
            await this.sleep(500)
            ms += 500
        }
        if (!(await targetImage.getAttribute('src')).startsWith('http')) throw 'Image didn\'t load fast enough'
        imageURL = await targetImage.getAttribute('src')
    } finally {
        await driver.quit()
    }
    return imageURL
}

// Save an image from a URL to the filesystem
// Optionally skip ensuring the destination directory exists if you're sure it does
module.exports.saveImageFromURL = (imageURL, destDir, fileName, ensureDir = true) => {
    if (ensureDir) this.mkdirIfNeeded(destDir)
    return new Promise((resolve, reject) => {
        let extension = imageURL.split('.').pop()
        let file = fs.createWriteStream(destDir + '/' + fileName + '.' + extension)
        https.get(imageURL, (response) => {
            response.pipe(file);
            response.on('end', () => {
                if (response.statusCode != 200) reject(response.statusMessage)
                else resolve()
            })
        })
    })
}

// Read a comma (or newline, or both) separated list of queries from a file
module.exports.readQueriesFromFile = (filePath) => fs.readFileSync(filePath).toString().split('\n').join(',').split(',').map(str => str.trim()).filter(str => str != '')

// Grab and save a Google image for each of several queries (with a delay between queries)
module.exports.grabAndSaveSeveralImages = async (queries, destDir, minutesDelay, msWait, skipExisting = false, randomizeDelay = false, quiet = false) => {
    this.mkdirIfNeeded(destDir)
    let msDelay = minutesDelay * 60 * 1000
    queries = queries.map(query => this.sanitizeQuery(query))
    for (let i = 0; i < queries.length; i++) {
        if (!quiet) console.log((i + 1) + ' of ' + queries.length + '...')
        let cont = true
        if (skipExisting) {
            let existingImage = glob.sync(destDir + '/' + queries[i] + '.*')[0]
            if (existingImage) {
                cont = false
                if (!quiet) console.log('There is alread an image matching this query, so it will be skipped.')
            }
        }
        if (cont) {
            try {
                this.saveImageFromURL(await this.grabImageURL(queries[i], false, msWait), destDir, queries[i], false)
                if (!quiet) console.log('Saved.')
            } catch (err) {
                if (!quiet) console.error('Error: ' + err)
            }
            if (i < queries.length - 1) {
                let delay = msDelay
                if (randomizeDelay) delay = (Math.random() * (msDelay / 2)) + (msDelay / 2)
                if (!quiet) console.log('Waiting ' + (Math.round((delay / 1000 / 60) * 100) / 100) + ' minutes...')
                await this.sleep(delay)
            }
        }
    }
    if (!quiet) console.log('Done')
}