const funcs = require('./funcs')
const config = require('./config').config


const loop = async () => {
    try {
        await funcs.grabAndSaveSeveralImages(queries, config.outputImagesDir, config.minutesDelay, config.msWait, config.skipExisting, config.randomizeDelay)
    } catch (err) {
        console.error('Error: ' + err)
    }
}

const queries = funcs.readQueriesFromFile(config.queriesFilePath)
loop().catch(err => console.error(err))