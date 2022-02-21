const fs = require('fs')
const { execFile } = require('child_process')

console.log("\x1b[1;45m            \x1b[1;46m     \x1b[0m\n\x1b[1;45;37m Localise\x1b[1;37;46m Times  \x1b[0m\n\x1b[1;45m      \x1b[1;46m           \x1b[0m")


fs.readFile('popup/tzInfo.js', {encoding: 'utf8'}, (errTZ, dataTZ) => {
	if (errTZ) {
		console.error("Error reading the web extension file\n", errTZ)
		return
	}

	fs.readFile('localisetimes.js', {encoding: 'utf8'}, (err, data) => {
		if (err) {
			console.error("Error reading the web extension file\n", err)
			return
		}

		console.log("Web extension loaded...")

		//Apply a few simple patches to the web extension so it's usable in the test suite
		const webExt = patchWebExt(data, dataTZ)

		fs.writeFile('tests/testfile.js', webExt, err => {
			if (err) {
				console.error("Error writing the test file\n", err)
				return
			}

			console.log("   ...rewritten and ready.")

			const child = execFile('node', ['tests/testsuite.js'], (error, stdout, stderr) => {
				if (error) {
					throw error
				}
				console.log(stdout)
				fs.unlink('tests/testfile.js', () => {})
			})

		})
	})
	
})

function patchWebExt(input, tzInfo) {
	let output

	//Remove some unnecessary function calls
	output = input.replace(/lookForTimes\(\);[\S\s]*function handleMutations/, "}}\nfunction handleMutations")

	//Comment out the listener used by the web extension
	output = output.replace("chrome.runtime.onMessage", "//chrome.runtime.onMessage")
	output = `"use strict";\nconst chrome = { storage: { local: { get: () => {} } }, runtime: { getURL: () => {} }, i18n: { getMessage: () => {} } }
	testTimezone = "Etc/GMT-1";
	function changeTestTimezone(newTimezone) {
		testTimezone = newTimezone;
		dateTimeFormats = new Array(2);
	}` + output.substring(15)

	//Make the required code available to the test suite
	output += "\n\nbuildTimeRegex();init();\nexports.spotTime = spotTime;exports.defaultTZ = defaultTZ;exports.changeTestTimezone = changeTestTimezone;"
	output = output.replace(/userSettings\.defaults/g, "defaultTZ")

	//Force the local timezone to BST (GMT + 1)
	//This makes the test results consistent regardless of where you live
	let matches = output.matchAll(/{( )hour:/g)
	for (const match of matches) {
		output = output.replace(match[0], `{ timeZone: testTimezone, hour:`)
	}
	//Fake the timezone offset.
	output = output.replace(/dateObj.getTimezoneOffset\(\);/g, "0;")
	//Force north american time aliases into summer time
	output = output.replace("(tmpNow > toDST && tmpNow < fromDST)", "true");

	output = tzInfo + "\n" + output;

	return output
}