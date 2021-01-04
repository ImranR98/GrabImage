const funcs = require('./funcs')
const config = require('./config').config


const loop = async () => {
    while (true) { // Keep trying until manually aborted
        try {
            await funcs.grabAndSaveSeveralImages(queries, config.outputImagesDir, config.minutesDelay, config.msWait, config.maxImageIndex, config.skipExisting, config.randomizeDelay, false)
            break;
        } catch (err) {
            console.error('Error: ' + err)
        }
    }
}

const queries = funcs.readQueriesFromFile(config.queriesFilePath)
loop().catch(err => console.error(err))