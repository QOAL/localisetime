const fs = require('fs')
const { execFile } = require('child_process')

console.log("\x1b[1;45m            \x1b[1;46m     \n\x1b[1;45;37m Localise\x1b[1;37;46m Times  \n\x1b[1;45m      \x1b[1;46m           \x1b[0m")

fs.readFile('../localisetimes.js', {encoding: 'utf8'}, (err, data) => {
	if (err) {
		console.error("Error reading the web extension file\n", err)
		return
	}

	console.log("Web extension loaded...")

	//Remove the call to init, and export the spotTime function
	const webExt = data.replace('init();', '') + "\n\nexports.spotTime = spotTime;exports.tzaolObj = tzaolObj"

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