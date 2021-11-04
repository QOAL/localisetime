var AdmZip = require("adm-zip")
var manifestJson = require("../manifest.json")

console.log("\x1b[1;45m            \x1b[1;46m     \x1b[0m\n\x1b[1;45;37m Localise\x1b[1;37;46m Times  \x1b[0m\n\x1b[1;45m      \x1b[1;46m           \x1b[0m")
console.log(`Creating web extension archive for ${manifestJson.version}`)

var zip = new AdmZip()

zip.addLocalFolder("_locales", "_locales")
zip.addLocalFolder("icons", "icons")
zip.addLocalFolder("popup", "popup")

zip.addLocalFile("localisetimes.js")
zip.addLocalFile("manifest.json")
zip.addLocalFile("static.css")

zip.writeZip(`build/localisetimes_${manifestJson.version.replace(/\./g,"-")}.zip`)

console.log(`...Done!`)
