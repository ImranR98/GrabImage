const funcs = require('./funcs')
const config = require('./config').config

const queries = funcs.readQueriesFromFile(config.queriesFilePath)
funcs.grabAndSaveSeveralImages(queries, config.outputImagesDir, config.minutesDelay, config.msWait, config.skipExisting, config.randomizeDelay).catch(err => console.error(err))