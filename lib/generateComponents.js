const path = require('path')
const fs = require('fs')
const SVGO = require('svgo')
const log = require('./customLogger')
const strings = require('./strings')
const renderMarkup = require('./renderMarkup')
const writeComponentsFile = require('./writeComponentsFile')
const optimizer = new SVGO()

const isPathValid = (pathString, type) => {
  let stats

  // If path is relative
  if (pathString[0] === '.' || pathString !== '/') {
    pathString = path.resolve(process.cwd(), pathString)
  }

  try {
    stats = fs.lstatSync(pathString)
  } catch (error) {
    return false
  }

  if (type === 'directory') {
    return stats.isDirectory()
  } else if (type === 'file') {
    return stats.isFile()
  } else if (type === 'any') {
    return stats.isDirectory() || stats.isFile()
  } else {
    return false
  }
}

/**
 * Function to generate strings, which will be used in components file creating
 * @param {Array<Object>} filesTexts - array of object, consisting of svg file name and source
 * @param {Object}        config     - object with command settings
 * @return {Void}
 */
function generateComponentsStrings (filesTexts, config) {
  filesTexts.forEach(svg => {
    let reactImportString
    let svgLibImportString
    let componentDeclarationString
    let endOfDeclaration
    let markup
    let exportingString

    if (config.typescript) {
      reactImportString = strings.import.reactOnTypescript()
    } else {
      reactImportString = strings.import.react()
    }

    componentDeclarationString = strings.componentDeclaration(svg.filename)

    markup = renderMarkup(svg.source, config)

    if (config.reactNative) {
      let usedTags = []
      markup.usedTags.forEach(tag => usedTags.push(tag))
      svgLibImportString = strings.import.reactNaiveSvg(usedTags)
    } else {
      svgLibImportString = ''
    }

    endOfDeclaration = strings.endOfDeclaration()

    exportingString = strings.exportingString(svg.filename)

    writeComponentsFile({
      reactImportString: reactImportString,
      svgLibImportString: svgLibImportString,
      componentDeclarationString: componentDeclarationString,
      markup: markup.outputString,
      endOfDeclaration: endOfDeclaration,
      exportingString: exportingString
    }, svg.filename, config)
  })
}

function optimizeSources (svgSources, config) {
  let filesTexts = []
  svgSources.forEach(content => {
    fs.readFile(content, 'utf8', (err, data) => {
      if (err) {
        log.error(err)
      }

      optimizer.optimize(data, res => {
        let filename = path.win32.basename(content, '.svg')
        filename = filename[0].toUpperCase() + filename.slice(1)
        filesTexts.push({
          filename: filename,
          source: res.data
        })

        if (filesTexts.length === svgSources.length) {
          generateComponentsStrings(filesTexts, config)
        }
      })
    })
  })
}

module.exports = config => {
  let svgSources = []

  if (!isPathValid(config.pathToFiles, 'any')) {
    log.error('\nmsvgc --folder [pathToFiles], path to directory with .svg files or concrete file\n')
    process.exit(1)
  } else if (isPathValid(config.pathToFiles, 'directory')) {
    const dirContent = fs.readdirSync(config.pathToFiles)

    dirContent.forEach(content => {
      let filePath = path.resolve(config.pathToFiles, content)

      if (isPathValid(filePath, 'file') && path.extname(filePath) === '.svg') {
        svgSources.push(filePath)
      }
    })
  } else if (path.extname(config.pathToFiles) === '.svg') {
    svgSources.push(config.pathToFiles)
  }

  if (!isPathValid(config.targetPath, 'directory')) {
    log.error('\nmsvgc --output [targetPath], path must be path to folder\n')
    process.exit(1)
  }

  optimizeSources(svgSources, config)
}
