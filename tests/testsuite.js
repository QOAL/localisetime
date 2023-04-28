const webExt = require('./testfile')

// Console styling
const Reset = "\x1b[0m"
const PassStyle = "\x1b[1;42;37m"
const FailStyle = "\x1b[1;41;37m"
const FailIndent = "\x1b[1;41m \x1b[0m "
const SoftFailStyle = "\x1b[1;40;33m"
const SoftFailIndent = "\x1b[1;40m \x1b[0m "
const InfoStyle = "\x1b[38;5;252m\x1b[48;5;237m"

// Number of randomly generated time strings to test
const numRandTimes = 10000

// Whether or not to output about passed (non-random) tests
const quietPasses = true

/*

	Use Etc/GMT+/-X instead of the locations time zone, as we force summertime currently
	 (e.g. Etc/GMT+4 instead of america/new_york)

	"TimezoneOffset": [
		[ InputString, [LocalisedTime1, LocalisedTime2...] ]
	]

*/
const tests = {
	"Etc/GMT-1": [
		["16pt", [undefined]],
		["2 past", [undefined]],
		["15:10:30 PDT", ["23:10:30"]],
		["5:30:15-7pm GMT", ["18:30:15 – 20:00"]],
		["10a pt", ["18:00"]],
		["6am UTC+4", ["03:00"]],
		["2am UTC+0", ["03:00"]],
		["10am-1pm JST", ["02:00 – 05:00"]],
		["10am‒13 JST", ["02:00 – 05:00"]],
		["10–1pm JST", ["02:00 – 05:00"]],
		["10—1 JST", ["02:00 – 05:00"]],
		["10am-9 JST", ["02:00 – 13:00"]],
		["5PM PDT, 8PM EDT", ["01:00", "01:00"]],
		["5PM PDT - 8PM EDT", ["01:00", "01:00"]],
		["1:10 P. BST", ["13:10"]],
		["1pm PT, 2pm MT, 3pm CT, 4pm ET", ["21:00", "21:00", "21:00", "21:00"]],
		["a2{FF<JB) 1 A. \e rB[3mT- + ^EnWXUT B*vU3rm", [undefined]],
		["n_<^Yut .g'e)J 1:40 p. ATTSSKXd 3et", [undefined]], //"08:00"
		["24:00 CST", [undefined]],
		["23:60 BST", [undefined]],
		["00:00 CEST", ["23:00"]],
		["00:00:9 CEST", [undefined]],
		["1:10 p.m. cest", ["12:10"]],
		["01:30 jst", ["17:30"]],
		["1:30am jst", ["17:30"]],
		["1:30pm jst", ["05:30"]],
		["8| 01:30 jst", ["17:30"]],
		["1 cat just isn't enough", [undefined]],
		["02:37 KST", ["18:37"]],
		["2100 CEST", ["20:00"]],
		["Sie sagt bei einer Inzidenz von unter 140 ist es...", [undefined]],
		["Die Studiotechnik für 720p ist noch nicht abgeschrieben.", [undefined]],
		["In Deutschland war Amazon 2020 mit einem Umsatz von", [undefined]],
		["720p IST, 720pm ist", ["14:50", "14:50"]],
		["7:20p IST, 7:20pm ist", ["14:50", "14:50"]],
		["720p 576p", [undefined]],
		["Der Schuss bei 1:14 ist sehr schoen abgestimmt. 10/10.", ["20:44"]],
		["Starship dry mass should be ~105mt, propellant is 1,200mt, suggests ~1,300mt total mass, sans payload. Raptors produce ~ 200mt thrust, so six sea level engines should be able to lift a fully fueled Starship, assuming they red line thrust.", [undefined]],
		["9:37pm British Summer Time", ["21:37"]],
		["See you tomorrow at 1PM Eastern time! (1pm ET)", ["18:00", "18:00"]],
		["November 4th at 6:00 AM Pacific Time", ["14:00"]],
		["A m;TR2S 2Rt~n#8V, .?Si2ya YzrLAgSf/ SV[2bst+ 1:30 p.m. NDT bJfHiD -mMmP CM3", ["17:00"]], //"02:00", "17:00"
		["Only 1 cat per person, sorry!", [undefined]],
		["See you at 1 CAT", ["00:00"]], //undefined
		["Static fire test complete – targeting Tuesday, November 23 at 10:21 p.m. PT for Falcon 9’s launch of @NASA’s Double Asteroid Redirection Test", ["06:21"]],
		["9am et 9am 9am pt", ["14:00", "17:00"]],
		//["7pm - 21:00 UTC", [""]], //This is just a strangely formatted time range, I don't know what to do with it. (It's currently valid)
		["(16:30 UTC)", ["17:30"]],
		["18 cost card", [undefined]],
		["2020 art", [undefined]],
		["30:15 gmt", [undefined]],
		["3 a bit", [undefined]],
		["3 a BIT", ["16:00"]],
		["Population (2015 est.)", [undefined]],
		["20:15 EST", ["02:15"]],
		["12 CEST", ["11:00"]],
		["09 CEST", ["08:00"]],
		["9 CEST", ["08:00"]],
		["14:00 - 2:00 UTC", ["15:00 – 03:00"]],
		["2: CT", [undefined]],
		["10:49:46 GMT+02:00, 10:49:46 GMT+2:00, 10:49:46 GMT+0200, 10:49:46 GMT+2", ["09:49:46", "09:49:46", "09:49:46", "09:49:46"]],
	],
	"Etc/GMT+7": [
		["5:30:15-7pm GMT", ["10:30:15 – 12:00"]],
		["10a pt", ["10:00"]],
		["6am UTC+4", ["19:00"]],
		["2am UTC+0", ["19:00"]],
		["10am-1pm JST", ["18:00 – 21:00"]],
		["5PM PDT, 8PM EDT", ["17:00", "17:00"]],
		["5PM PST, 8PM EST", ["18:00", "18:00"]],
		["1:10 P. BST", ["05:10"]],
		["1pm PT, 2pm MT, 3pm CT, 4pm ET", ["13:00", "13:00", "13:00", "13:00"]],
	],
}
let passCount = 0
let totalTests = 0

console.log("The test suite is now starting")
// Check all the above tests pass
Object.keys(tests).forEach(tz => {
	console.log(InfoStyle, `Testing times in ${tz} (${tests[tz].length} tests)`, Reset)
	// Switch to the groups given time zone
	webExt.changeTestTimezone(tz)
	
	totalTests += tests[tz].length

	tests[tz].forEach(test => testStr(...test))
})

const outputStyle = passCount === tests.length ? PassStyle : FailStyle

console.log("The results are in...")
console.log(outputStyle, `${passCount} / ${totalTests} test${passCount == 1 ? '' : 's'} passed (${Math.round(passCount / totalTests * 100)}%)`, Reset)

//Test against some random data
console.log(`\nNow testing ${numRandTimes} random times`)
testRandomTimes()


function randomTime(options = {}) {
	//options: tfHour, hours, minutes, includeTZ, timezone
	//"Interesting" function to produce times
	let meridiem = "";
	let tfHour = "tfHour" in options ? options.tfHour : Math.random() >= .5;
	let hours = "hour" in options ? options.hour : getRandomInt(23);
	let minutes = "mins" in options ? options.mins : false;
	let timezone = "timezone" in options ? options.timezone : false
	let includeTZ = timezone ? true : ("includeTZ" in options ? options.includeTZ : Math.random() >= .4);
	/*if (!options.tfHour) {
		tfHour = Math.random() >= .5;
	} else {
		tfHour = options.tfHour;
	}
	if (typeof options.hours == "undefined") {
		hours = getRandomInt(23);
	}*/
	if (!tfHour) {
		meridiem = randomMeridiemStyle(hours > 12 ? 'PM' : 'AM');
		hours %= 12;
	}
	if (hours == 0 && !meridiem) { hours = '00'; } else { hours = 1 } //00 AM isn't right, so just shift it to 1 am
	if (minutes === false) {
		minutes = Math.random() > .75 ? '' : (getRandomInt(99) % 12) * 5;
	}
	//ugly messing around with minutes
	minutes = ('00' + String(minutes)).slice(-2);
	if (minutes !== '00' || Math.random() > .75 || meridiem == "") {
		minutes = ':' + minutes;
	} else {
		minutes = '';
	}
	/*if (typeof timezone == "undefined") {
		includeTZ = typeof includeTZ !== "undefined" ? includeTZ : Math.random() >= .4;
	} else {
		includeTZ = true;
	}*/
	let tzOffset = !("noOffset" in options) && Math.random() > .8 ? buildRandomTZOffset() : '';
	let prePad = options.padWithNonsense ? makeNonsense() + ' ' : '';
	let postPad = options.padWithNonsense ? ' ' + makeNonsense() : '';

	let rangeStr = '';
	if ((!("useRange" in options) || options.useRange == true) && Math.random() > .5) {
		const dashes = [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015];
		const padDash = (Math.random() > .3 ? " " : "")
		rangeStr = randomTime({'includeTZ': false, 'tfHour': tfHour, 'useRange': false})[0] +
			padDash + String.fromCharCode(dashes[getRandomInt(5)]) + padDash;
	}

	return [prePad + rangeStr + String(hours) + String(minutes) + meridiem + (includeTZ ? (timezone ? ' ' + timezone : randomTZ()) + tzOffset: '') + postPad, !!rangeStr];
}
function randomMeridiemStyle(meridiem) {
	if (Math.random() > .75) {
		meridiem = meridiem.substring(0, 1)
	}
	if (Math.random() > .5) {
		meridiem = meridiem.split("").join(".") + "."
	}
	if (Math.random() >= .5) {
		meridiem = meridiem.toLowerCase();
	}
	if (Math.random() >= .5) {
		meridiem = " " + meridiem;
	}
	return meridiem
}
function randomTZ() {
	let tzKeys = Object.keys(webExt.defaultTZ);
	let randomTZStr = tzKeys[Math.floor(Math.random() * tzKeys.length)];
	return ' ' + (Math.random() > .5 ? randomTZStr : randomTZStr.toLowerCase());
}
function buildRandomTZOffset() {
	let offset = 1 + getRandomInt(3);
	let positive = Math.random() >= .5;
	let useSpaces = Math.random() >= .5;
	return (useSpaces ? ' ' : '') + (positive ? '+' : '-') + (useSpaces ? ' ' : '') + offset;
}
function makeNonsense() {
	let numWords = 1 + getRandomInt(6);
	let name = [];
	while (numWords > 0) {
		let wordLength = 1 + getRandomInt(9);
		let tmpWord = "";
		for (let i = 0; i < wordLength; i++) {
			tmpWord += String.fromCharCode(33 + getRandomInt(94));
		}
		name.push(tmpWord);
		numWords--;
	}
	return name.join(" ");
}

function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
}

function testStr(input, expects) {
	const result = webExt.spotTime(input)
	//Return an for each matching time: [localisedTimeString, fullMatchingString, matchStartOffset, lengthOfTheFullMatchingString]

	const failedAsExpected = (result.length === 0 && expects.every(e => e === undefined))

	//Check that every result is expected (Needs to check both ways to catch missing entries)
	const pass = failedAsExpected || (
		(Math.max(1, result.length) === expects.length) && expects.every(
			(e, i) => e === (result && result[i] ? result[i].localisedTime : undefined)
		)
	)

	if (pass) {
		if (!quietPasses) {
			console.log(PassStyle, "PASS", Reset, input)
		}
		passCount++
	} else {
		console.log(FailStyle, "FAIL", Reset, input)
		if (expects.length >= result.length) {
			expects.map( (e,i) => {
				console.log(
					`${FailIndent}Expected:`,
					`\x1b[47;30m${e}${Reset}`,
					`\n${FailIndent}     Got:`,
					`\x1b[47;30m${result && result[i] ? result[i].localisedTime : undefined}${Reset}`
				)
			})
		} else {
			result.map( (r,i) => {
				console.log(
					`${FailIndent}Expected:`,
					`\x1b[47;30m${expects && expects[i] ? expects[i] : undefined}${Reset}`,
					`\n${FailIndent}     Got:`,
					`\x1b[47;30m${r[0]}${Reset}`
				)
			})
		}
	}
}

function testRandomTimes() {
	let errors = 0
	let likelyFalsePositives = 0
	let result
	let tmpTime
	let shouldBeValid
	let useNonsensePadding
	console.time("Execution time");
	for (let i = 0; i < numRandTimes; i++) {
		shouldBeValid = Math.random() > .25
		useNonsensePadding = Math.random() >= .5
		tmpTime = randomTime({ 'includeTZ': shouldBeValid, 'padWithNonsense': useNonsensePadding })
		result = webExt.spotTime(tmpTime[0])
		//Return an for each matching time: [localisedTimeString, fullMatchingString, matchStartOffset, lengthOfTheFullMatchingString]

		const pass = shouldBeValid ? (tmpTime[1] ? result && result[0] && result[0].localisedTime.indexOf(" – ") !== -1 : result && result[0]) : result && result[0] === undefined

		if (!pass) {
			errors++
			if (useNonsensePadding) {
				likelyFalsePositives++
			}
			console.log(
				`${useNonsensePadding ? SoftFailStyle : FailStyle} FAIL ${Reset} Time ${InfoStyle}with${shouldBeValid ? '' : 'out'}${Reset} timezone`,
				`\n${useNonsensePadding ? SoftFailIndent : FailIndent} Input:`,
				`\x1b[47;30m${tmpTime[0]}${Reset}`,
				`\n${useNonsensePadding ? SoftFailIndent : FailIndent}Output:`,
				`\x1b[47;30m${result && result[0] ? result[0].localisedTime : undefined}${Reset}`
			)
		}
	}
	if (errors > 0) {
		console.log(`${FailStyle} ${errors} error${errors == 1 ? '' : 's'} occoured! ${Reset}`)
		const plural = likelyFalsePositives !== 1;
		const falsePosString = ['of which is likely to be a false positive', 'of which are likely to be false positives'][+plural]
		console.log(`${FailIndent}${likelyFalsePositives} ${falsePosString}`)
	} else {
		console.log(`${PassStyle} No issues found ${Reset}`)
	}
	console.timeEnd("Execution time");
}