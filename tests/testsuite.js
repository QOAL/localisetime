const webExt = require('./testfile')
//spotTime(str, dateObj)

const dateObj = new Date()

function randomTime(options = {}) {
	//options: tfHour, hours, minutes, includeTZ, timezone
	//"Interesting" function to produce times
	let apm = "";
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
		apm = randomMeridiemStyle(hours > 12 ? 'PM' : 'AM');
		hours %= 12;
	}
	if (hours == 0 && !apm) { hours = '00'; } else { hours = 1 } //00 AM isn't right, so just shift it to 1 am
	if (minutes === false) {
		minutes = Math.random() > .75 ? '' : (getRandomInt(99) % 12) * 5;
	}
	//ugly messing around with minutes
	minutes = ('00' + String(minutes)).slice(-2);
	if (minutes !== '00' || Math.random() > .75 || apm == "") {
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
	return makeNonse() + " " + String(hours) + String(minutes) + apm + (includeTZ ? (timezone ? ' ' + timezone : randomTZ()) + tzOffset: '') + " " + makeNonse();
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
function makeNonseName() {
	let numWords = 1 + getRandomInt(3);
	let name = [];
	while (numWords > 0) {
		let wordLength = 1 + getRandomInt(9);
		let tmpWord = "";
		for (let i = 0; i < wordLength; i++) {
			tmpWord += String.fromCharCode(97 + getRandomInt(25));
		}
		name.push(tmpWord);
		numWords--;
	}
	return name.join(" ");
}
function buildRandomTZOffset() {
	let offset = 1 + getRandomInt(3);
	let positive = Math.random() >= .5;
	let useSpaces = Math.random() >= .5;
	return (useSpaces ? ' ' : '') + (positive ? '+' : '-') + (useSpaces ? ' ' : '') + offset;
}

function makeNonse() {
	let numWords = 1 + getRandomInt(6);
	let name = [];
	while (numWords > 0) {
		let wordLength = 1 + getRandomInt(9);
		let tmpWord = "";
		for (let i = 0; i < wordLength; i++) {
			tmpWord += String.fromCharCode(33 + getRandomInt(95));
		}
		name.push(tmpWord);
		numWords--;
	}
	return name.join(" ");
}

function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
}

const Reset = "\x1b[0m"
const PassStyle = "\x1b[1;42;37m"
const FailStyle = "\x1b[1;41;37m"
const FailIndent = "\x1b[1;41m \x1b[0m "

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

const numRandTimes = 10000
function testRandomTimes() {
	let errors = 0
	let result
	let tmpTime
	let includeTimezone = [{'includeTZ': true}, {'includeTZ': false}]
	let shouldBeValid
	for (let i = 0; i < numRandTimes; i++) {
		shouldBeValid = Math.random() > .25
		tmpTime = randomTime(includeTimezone[shouldBeValid ? 0 : 1])
		result = webExt.spotTime(tmpTime, dateObj)
		//Return an for each matching time: [localisedTimeString, fullMatchingString, matchStartOffset, lengthOfTheFullMatchingString]

		const pass = shouldBeValid ? result && result[0] : result && result[0] === undefined

		if (!pass) {
			errors++
			console.log(
				`${FailStyle} FAIL ${Reset} Time with${shouldBeValid ? '' : 'out'} timezone`,
				`\n${FailIndent} Input:`,
				`\x1b[47;30m${tmpTime}${Reset}`,
				`\n${FailIndent}Output:`,
				`\x1b[47;30m${result && result[0] ? result[0][0] : undefined}${Reset}`
			)
		}
	}
	if (errors > 0) {
		console.log(`${FailStyle} ${errors} error${errors == 1 ? '' : 's'} occoured! ${Reset}`)
	} else {
		console.log(`${PassStyle} No issues found ${Reset}`)
	}
}

//[ InputString, [LocalisedTime1, LocalisedTime2...] ]
const tests = [
	["16pt", [undefined]],
	["2 past", [undefined]],
	["15:10:30 PDT", ["23:10:30"]],
	["5:30:15-7pm GMT", ["18:30:15 – 20:00"]],
	["10a pt", ["11:00"]],
	["6am UTC+4", ["03:00"]],
	["2am UTC+0", ["03:00"]],
	["10am-1pm JST", ["02 – 05:00"]],
	["10am-13 JST", ["02 – 05:00"]],
	["10-1pm JST", ["02 – 05:00"]],
	["10-1 JST", ["02 – 05:00"]],
	["10am-9 JST", ["02 – 13:00"]],
	["5PM PDT, 8PM EDT", ["01:00", "01:00"]],
	["5PM PDT - 8PM EDT", ["01:00", "01:00"]],
	["1:10 P. BST", ["13:10"]],
	["a2{FF<JB) 1 A. \e rB[3mT- + ^EnWXUT B*vU3rm", [undefined]],
	["n_<^Yut .g'e)J 1:40 p. ATTSSKXd 3et", [undefined]],
	//"n_<^Yut .g'e)J 1:40 p. ATTSSKXd 3et" matches on the 3et, which is ambiguous
]
let passCount = 0

console.log("The test suite is now starting")

tests.map( test => testStr(...test) )

const outputStyle = passCount === tests.length ? PassStyle : FailStyle

console.log("The results are in...")
console.log(outputStyle, `${passCount} / ${tests.length} test${passCount == 1 ? '' : 's'} passed (${Math.round(passCount / tests.length * 100)}%)`, Reset)

console.log(`Now testing ${numRandTimes} random times`)
testRandomTimes()