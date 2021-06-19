const webExt = require('./testfile')
//spotTime(str, dateObj)

const dateObj = new Date()

const Reset = "\x1b[0m"
const PassStyle = "\x1b[1;42;37m"
const FailStyle = "\x1b[1;41;37m"
const FailIndent = "\x1b[1;41m \x1b[0m "
const SoftFailStyle = "\x1b[1;40;33m"
const SoftFailIndent = "\x1b[1;40m \x1b[0m "

const numRandTimes = 1000

//[ InputString, [LocalisedTime1, LocalisedTime2...] ]
const tests = [
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
	["n_<^Yut .g'e)J 1:40 p. ATTSSKXd 3et", ["08:00"]],
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
	["720p IST, 720pm ist", ["14:50", "14:50"]],
	["Der Schuss bei 1:14 ist sehr schoen abgestimmt. 10/10.", ["20:44"]]
]
let passCount = 0

console.log("The test suite is now starting")
//Check all the above tests pass
tests.map( test => testStr(...test) )

const outputStyle = passCount === tests.length ? PassStyle : FailStyle

console.log("The results are in...")
console.log(outputStyle, `${passCount} / ${tests.length} test${passCount == 1 ? '' : 's'} passed (${Math.round(passCount / tests.length * 100)}%)`, Reset)

//Test against some random data
console.log(`Now testing ${numRandTimes} random times`)
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
	let tzKeys = Object.keys(webExt.tzaolObj);
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
	const result = webExt.spotTime(input, dateObj)
	//Return an for each matching time: [localisedTimeString, fullMatchingString, matchStartOffset, lengthOfTheFullMatchingString]

	//Check that every result is expected (Needs to check both ways to catch missing entries)
	//const pass = expects.every( e => result.includes(e) ) && result.every( e => expects.includes(e) )
	//const pass = expects.every( (e,i) => { console.log(">",e, i, result[i][0]); return result[i][0] === e })
	//const pass = expects.every( (e, i) => console.log("\x1b[47;30m>\x1b[0m", e, i, result[i] ? result[i][0] : false) )
	const pass = (Math.max(1, result.length) === expects.length) && expects.every( (e, i) => e === (result && result[i] ? result[i][0] : undefined) )

	if (pass) {
		console.log(PassStyle, "PASS", Reset, input)
		passCount++
	} else {
		console.log(FailStyle, "FAIL", Reset, input)
		if (expects.length >= result.length) {
			expects.map( (e,i) => {
				console.log(
					`${FailIndent}Expected:`,
					`\x1b[47;30m${e}${Reset}`,
					`\n${FailIndent}     Got:`,
					`\x1b[47;30m${result && result[i] ? result[i][0] : undefined}${Reset}`
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
	for (let i = 0; i < numRandTimes; i++) {
		shouldBeValid = Math.random() > .25
		useNonsensePadding = Math.random() >= .5
		tmpTime = randomTime({ 'includeTZ': shouldBeValid, 'padWithNonsense': useNonsensePadding })
		result = webExt.spotTime(tmpTime[0], dateObj)
		//Return an for each matching time: [localisedTimeString, fullMatchingString, matchStartOffset, lengthOfTheFullMatchingString]

		const pass = shouldBeValid ? (tmpTime[1] ? result && result[0] && result[0][0].indexOf(" – ") !== -1 : result && result[0]) : result && result[0] === undefined

		if (!pass) {
			errors++
			if (useNonsensePadding) {
				likelyFalsePositives++
			}
			console.log(
				`${useNonsensePadding ? SoftFailStyle : FailStyle} FAIL ${Reset} Time with${shouldBeValid ? '' : 'out'} timezone`,
				`\n${useNonsensePadding ? SoftFailIndent : FailIndent} Input:`,
				`\x1b[47;30m${tmpTime[0]}${Reset}`,
				`\n${useNonsensePadding ? SoftFailIndent : FailIndent}Output:`,
				`\x1b[47;30m${result && result[0] ? result[0][0] : undefined}${Reset}`
			)
		}
	}
	if (errors > 0) {
		console.log(`${FailStyle} ${errors} error${errors == 1 ? '' : 's'} occoured! ${Reset}`)
		console.log(`${FailIndent}${likelyFalsePositives} of which ${likelyFalsePositives == 1 ? 'is' : 'are'} likely to be false positives`)
	} else {
		console.log(`${PassStyle} No issues found ${Reset}`)
	}
}