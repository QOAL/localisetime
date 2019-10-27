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
		})

	})
})

function patchWebExt(input) {
	let output

	//Remove some unnecessary function calls
	output = input.replace(/lookForTimes\(\);[\S\s]*function handleMutations/, "}\nfunction handleMutations")

	//Make the required code available to the test suite
	output += "\n\nexports.spotTime = spotTime;exports.tzaolObj = tzaolObj"

	//Force the local timezone to BST (GMT + 1)
	//This makes the test results consistent regardless of where you live
	let dateObj = new Date()
	let useTimezone = dateObj.getTimezoneOffset() === 0 ? 'Etc/GMT-2' : 'Etc/GMT-1'
	let matches = output.matchAll(/(\n.*toLocaleTimeString)/g);
	for (const match of matches) {
		output = output.replace(match[0], `\ntimeFormat.timeZone = '${useTimezone}';` + match[0])
	}

	return output
}