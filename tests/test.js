const fs = require('fs')
const { execFile } = require('child_process')

console.log("\x1b[1;45m            \x1b[1;46m     \n\x1b[1;45;37m Localise\x1b[1;37;46m Times  \n\x1b[1;45m      \x1b[1;46m           \x1b[0m")

fs.readFile('../localisetimes.js', {encoding: 'utf8'}, (err, data) => {
	if (err) {
		console.error("Error reading the web extension file\n", err)
		return
	}

	console.log("Web extension loaded...")

	//Apply a few simple patches to the web extension so it's usable in the test suite
	const webExt = patchWebExt(data)

	fs.writeFile('testfile.js', webExt, err => {
		if (err) {
			console.error("Error writing the test file\n", err)
			return
		}

		console.log("   ...rewritten and ready.")

		const child = execFile('node', ['testsuite.js'], (error, stdout, stderr) => {
			if (error) {
				throw error
			}
			console.log(stdout)
			fs.unlink('testfile.js', () => {})
		})

	})
})

function patchWebExt(input) {
	let output

	//Remove some unnecessary function calls
	output = input.replace(/lookForTimes\(\);[\S\s]*function handleMutations/, "}\nfunction handleMutations")

	//Comment out the listener used by the web extension
	output = output.replace("chrome.runtime.onMessage", "//chrome.runtime.onMessage")
	output = `"use strict";\nconst chrome = { storage: { local: { get: () => {} } }, runtime: { getURL: () => {} }, i18n: { getMessage: () => {} } }` + output.substring(15)

	//Make the required code available to the test suite
	output += "\n\nbuildTimeRegex();init();\nexports.spotTime = spotTime;exports.defaultTZ = defaultTZ"
	output = output.replace(/userSettings\.defaults/g, "defaultTZ")

	//Force the local timezone to BST (GMT + 1)
	//This makes the test results consistent regardless of where you live
	output = output.replace(/let tmpDate = new Date\(\s/g, 'let tmpDate = new Date(Date.UTC(');
	output = output.replace(/\.substring\(1\) : 0/g, '.substring(1) : 0)');
	let useTimezone = 'Etc/GMT-1'
	let matches = output.matchAll(/(\n.*toLocaleTimeString)/g);
	for (const match of matches) {
		output = output.replace(match[0], `\ntimeFormat.timeZone = '${useTimezone}'; ${match[0]}`)
	}
	//Fake the timezone offset.
	output = output.replace(/dateObj.getTimezoneOffset\(\);/g, "0;")
	//Force north american time aliases into summer time
	output = output.replace(/tmpNow = Date.now\(\);/, "tmpNow = Date.UTC(thisYear, 3, tmpDay, 2);");

	return output
}