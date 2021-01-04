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

// Grab the first Google image result for the provided keyword and return it's URL (or its thumbnail in base64 if the URL does not load in time)
// You can opt not to sanitize the query if you're sure it already is
module.exports.grabImageURLOrBase64 = async (query, sanitize, index, msWait) => {
    if (sanitize) query = this.sanitizeQuery(query)
    let driver = await new Builder().forBrowser('chrome').build()
    let imageURL = ''
    let base64Image = ''
    try {
        await driver.get('https://www.google.com/search?tbm=isch&q=' + query)
        await (await driver.findElements(By.css('img.Q4LuWd')))[index].click()
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
        let data = await targetImage.getAttribute('src')
        if (data.startsWith('http')) imageURL = data
        else base64Image = data
    } finally {
        await driver.quit()
    }
    return { imageURL, base64Image }
}

// Save an image from a URL to the filesystem
// Optionally skip ensuring the destination directory exists if you're sure it does
module.exports.saveImageFromURL = (imageURL, destDir, fileName, ensureDir) => {
    if (ensureDir) this.mkdirIfNeeded(destDir)
    return new Promise((resolve, reject) => {
        let extension = imageURL.split('.').pop()
        if (extension.length > 4) extension = 'jpeg' // TODO: Extension cannot reliably be inferred from the URL; find a way to get it
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

// Save a base64 encoded image to the file system
// Optionally skip ensuring the destination directory exists if you're sure it does
module.exports.saveImageFromBase64 = (base64Image, destDir, fileName, ensureDir) => {
    if (ensureDir) this.mkdirIfNeeded(destDir)
    let matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    let response = {}
    if (matches.length !== 3) throw 'Invalid input string'
    response.type = matches[1];
    response.data = Buffer.from(matches[2], 'base64');
    fs.writeFileSync(destDir + '/' + fileName + '.' + response.type.split('/')[1], response.data)
}

// Grab and save a Google image result for the provided query
// If the first result can not be saved, subsequent results are used up to a specified maximum (with a delay between each attempt)
module.exports.processQuery = async (query, destDir, maxImageIndex, msWait, msDelay, ensureDir, sanitize) => {
    if (ensureDir) this.mkdirIfNeeded(destDir)
    if (sanitize) query = this.sanitizeQuery(query)
    let index = 0
    let imageData = null
    while (index <= maxImageIndex && !imageData) {
        if (index != 0) await this.sleep(msDelay)
        try {
            imageData = await this.grabImageURLOrBase64(query, false, index, msWait)
            if (imageData.imageURL != '') await this.saveImageFromURL(imageData.imageURL, destDir, query, false)
            else await this.saveImageFromBase64(imageData.base64Image, destDir, query, false)
        } catch (err) {
            if (index == maxImageIndex) throw err
        }
        index++
    }
    return (index - 1)
}

// Read a comma (or newline, or both) separated list of queries from a file
module.exports.readQueriesFromFile = (filePath) => fs.readFileSync(filePath).toString().split('\n').join(',').split(',').map(str => str.trim()).filter(str => str != '')

// Print a string on the current line instead of a new one
module.exports.oneLineLog = (value) => {
    process.stdout.write("\r\x1b[K") // Delete anything on the current line
    process.stdout.write(typeof value == 'string' ? value : JSON.stringify(value)) // Print value w/o adding a newline
}

module.exports.nowString = () => {
    let now = new Date()
    return `${now.getHours()}:${now.getMinutes()}`
}

// Save an image for each of several queries (with a delay between queries)
module.exports.grabAndSaveSeveralImages = async (queries, destDir, minutesDelay, msWait, maxImageIndex, skipExisting, randomizeDelay, quiet) => {
    this.mkdirIfNeeded(destDir)
    let msDelay = minutesDelay * 60 * 1000
    queries = queries.map(query => this.sanitizeQuery(query))
    for (let i = 0; i < queries.length; i++) {
        let cont = true
        if (skipExisting) {
            let existingImage = glob.sync(destDir + '/' + queries[i] + '.*')[0]
            if (existingImage) {
                cont = false
            }
        }
        if (cont) {
            if (!quiet) this.oneLineLog(this.nowString() + ': Query ' + (i + 1) + ' of ' + queries.length + ': Searching...')
            let delay = msDelay
            if (randomizeDelay) delay = (Math.random() * (msDelay / 2)) + (msDelay / 2)
            try {
                let indexSaved = await this.processQuery(queries[i], destDir, maxImageIndex, msWait, msDelay, false, false)
                if (!quiet) {
                    this.oneLineLog('')
                    console.log(this.nowString() + ': Query ' + (i + 1) + ' of ' + queries.length + ': Result ' + (indexSaved + 1) + ' saved.')
                }
            } catch (err) {
                if (!quiet) {
                    this.oneLineLog('')
                    console.error(this.nowString() + ': Query ' + (i + 1) + ' of ' + queries.length + ': Error searching for \'' + queries[i] + '\': ' + err + '.')
                }
            }
            if (i < queries.length - 1) {
                if (!quiet) this.oneLineLog(this.nowString() + ': Query ' + (i + 2) + ' of ' + queries.length + ': Waiting ' + (Math.round((delay / 1000 / 60) * 100) / 100) + ' minutes to search...')
                await this.sleep(delay)
            }
        } else {
            this.oneLineLog('')
            console.warn(this.nowString() + ': Query ' + (i + 1) + ' of ' + queries.length + ': Skipped as image already exists.')
        }
    }
    if (!quiet) {
        this.oneLineLog('')
        console.log(this.nowString() + ': Done.')
    }
}