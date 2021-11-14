const fs = require('fs')
const https = require('https')

const { Parser } = require("htmlparser2");
const { DomHandler } = require("domhandler");
const CSSselect = require("css-select");

let tzInfoObj = {}
let defaults = {}
const defaultOverrides = { "BST": 60, "MST": -420 }

console.log("Generating tzInfo.js...")

const handler = new DomHandler((error, dom) => {
	console.log("Parsing the response...")
	if (error) {
		// Handle error
	} else {
		// Parsing completed, do something
		const rows = CSSselect.selectAll(".wikitable tbody tr", dom)

		let tzInfo = []

		rows.forEach(row => {
			const eles = CSSselect.selectAll("td", row)
			if (eles.length === 0) { return }

			//Skip timezones that don't have a Wikipedia article
			if (!(eles[1].children[0] && eles[1].children[0].children && eles[1].children[0].children[0])) {
				return
			}

			const sortValue = String(eles[2].attribs['data-sort-value'])

			tzInfo.push(
				Array(
					eles[0].children[0].data, // Abbreviation
					eles[1].children.reduce(  // Text
							(text, cVal) => text += cVal.children && cVal.children[0] ? (cVal.children[0].data ?? '') : cVal.data,
							''
						)
						.replace(/\(([^)]*)\)/, '')
						.replace('unofficial', '')
						.replace('French-language name for CEST', '')
						.trim(),
					((+sortValue.substring(0, 3) - 100) * 60) + +sortValue.substr(-2)//parseInt(eles[2].attribs['data-sort-value']) // Offset
				)
			)
		})

		generateOutput(tzInfo)
	}
});

console.log("Fetching the Wikipedia page...")
httpRequest('en.wikipedia.org', '/w/api.php?action=parse&page=List_of_time_zone_abbreviations&prop=text&formatversion=2&format=json').then(page => {
	const parser = new Parser(handler);
	parser.write(JSON.parse(page).parse.text);
	parser.end();
})

function generateOutput(tzInfo) {
	console.log("Generating the output...")
	tzInfo.forEach(i => {
		if (!tzInfoObj[i[0]]) {
			tzInfoObj[i[0]] = [];
			defaults[i[0]] = i[2];
		}

		tzInfoObj[i[0]].push({
			offset: i[2],
			title: i[1]
		})

	})

	defaults = { ...defaults, ...defaultOverrides, ...{ PT: 0, MT: 0, CT: 0, ET: 0 } }

	//console.log(tzInfoObj, defaults);
	fs.writeFile('tzInfo.js', `const tzInfo = ${JSON.stringify(tzInfoObj)}\nconst defaultTZ = ${JSON.stringify(defaults)}`, err => {})
	console.log("Finished.")
}

function httpRequest(hostName, path) {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: hostName,
			port: 443,
			path: path,
			method: 'GET',
			//headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0' }
		}

		const req = https.request(options, res => {
			//console.log(`statusCode: ${res.statusCode}`)

			let chunks = []
			res.on('data', function (chunk) {
				chunks += chunk;
			});
			res.on('end', function (data) {
				resolve(chunks.toString('utf8'))
			});
		})

		req.on('error', error => {
			console.log(path, error);
			reject(false)
		})

		req.end()

	});
}
