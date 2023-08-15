const AdmZip = require("adm-zip")
const manifestJson = require("../manifest.json")
const fs = require('fs')

console.log("\x1b[1;45m            \x1b[1;46m     \x1b[0m\n\x1b[1;45;37m Localise\x1b[1;37;46m Times  \x1b[0m\n\x1b[1;45m      \x1b[1;46m           \x1b[0m")
console.log(`Creating web extension archives for ${manifestJson.version}`)

Array(
	{ manifest: "manifest_3C.json", tag: "_mv3C" },
	{ manifest: "manifest_2.json", tag: "_mv2" },
).forEach(info => {

	const zip = new AdmZip()

	zip.addLocalFolder("_locales", "_locales")
	zip.addLocalFolder("icons", "icons")
	zip.addLocalFolder("popup", "popup")

	zip.addLocalFile("localisetimes.js")
	zip.addFile("manifest.json", fs.readFileSync(info.manifest, 'utf8'))
	zip.addLocalFile("static.css")
	zip.addLocalFile("background.js")

	zip.writeZip(`build/localisetimes_${manifestJson.version.replace(/\./g,"-")}${info.tag}.zip`)

})

console.log(`...Done!`)
