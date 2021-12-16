"use strict";

let observer;

let dateTimeFormats = Array(2);

const shortHandInfo = {"PT": "Pacific Time", "ET": "Eastern Time", "CT": "Central Time", "MT": "Mountain Time"};

const fullTitleRegEx = "[a-z \-'áéí–]{3,45}?(?= time) time";

let timeRegex;

let manualTZ;

//Match group enumeration
const _G = {
	fullStr: 0,

	startHour: 1,
	startSeparator: 2,
	startMins: 3,
	startSeconds: 4,
	startMeridiem: 5,

	_timeSeparatorSpace: 6,
	timeSeparator: 7,

	hours: 8,
	separator: 9,
	mins: 10,
	seconds: 11,
	meridiem: 12,
	tzAbr: 13,
	offset: 14,
	_offsetWhiteSpace: 15
};

const whiteSpaceRegEx = /\s/g;

const preceedingRegEx = /\S/;// /[:.,'%\d]/;

const svgText = ["text", "tspan"];

let haveInsertedStaticCSS = false;

let clockEle;

const dateObj = new Date();

//Check the users (first 3) accepted languages, if one is German, then enforce IST being in upper case only as a time zone abbreviation.
const needsUppercaseIST = typeof window === "undefined" ? false : navigator.languages.findIndex((l,i) => i < 3 && l.split("-")[0] === "de") !== -1

const defaultSettings = {
	defaults: { ...defaultTZ },
	ignored: [],
	timeFormat: 0,
	includeClock: true,
	blankSeparator: true,
	avoidMatchingFloatsManually: true,
	enabled: true
}

let userSettings = { ...defaultSettings }

//Get any saved data
chrome.storage.local.get(defaultSettings, data => {
	//Merge the default timezone selection with the user's
	//This way we can keep the list updated, should any new ones be added.
	// (Obviously doesn't handle removal)
	userSettings = { defaults: { ...defaultSettings.defaults }, ...data };
	buildTimeRegex()
	init();
});

function buildTimeRegex() {
	const tzaolStr = Object.keys(userSettings.defaults).join("|") + "|" + fullTitleRegEx;
	//13% faster, but causes issues when manually converting
	//[a-z]{2,5}|' + fullTitleRegEx + '
	timeRegex = new RegExp('\\b(?:([01]?[0-9]|2[0-3])(:|\\.)?([0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?))?( ?)(to|until|til|and|or|[-\u2010-\u2015])\\6)?([01]?[0-9]|2[0-3])(:|\\.)?([0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?)(?= \\w|\\b))?(?:(?: ?(' + tzaolStr + '))(( ?)(?:\\+|-)\\15[0-9]{1,2})?)?\\b', 'giu');
	//[-|\\u{8211}|\\u{8212}|\\u{8213}]
}

function lookForTimes(node = document.body) {
	//Walk the dom looking for text nodes
	var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);

	var nodes = [];

	while(walker.nextNode()) {
		nodes.push(walker.currentNode);
	}

	for(var i = 0; node=nodes[i] ; i++) {

		//We should try and avoid working inside contenteditable="true" elements, as it could cause issues for the user
		//I'm going to assume that they don't get horribly nested, so only check up a few nodes.
		let tmpNode = node;
		let nodeCount = 0;
		let skipThis = false;
		while (tmpNode && tmpNode.parentNode && tmpNode !== document.body && nodeCount < 6) {
			if (tmpNode.parentNode.hasAttribute("contenteditable")) {
				skipThis = true;
				break;
			}
			tmpNode = tmpNode.parentNode;
			nodeCount++;
		}
		if (skipThis) { continue; }

		//Avoid any existing times that have already been converted
		if (node.parentElement.parentElement?.hasAttribute("data-localised")) { continue; }

		//Ignore any text nodes that are purely white space
		if (node.nodeValue.trim().length === 0) { continue; }

		//Look at each text node, and try and find valid times
		let timeInfo = spotTime(node.nodeValue);

		//We get an array back, if it has stuff in it then take action
		if (timeInfo.length === 0) { continue; }

		//Check if we've hit a text element in an SVG
		//We have to do a boring plain text replacement for this, as it'll be invalid otherwise
		if (svgText.includes(node.parentElement?.tagName) || svgText.includes(node.parentElement.parentElement?.tagName)) {
			handleTextNode(node, timeInfo);
			continue;
		}

		if (!haveInsertedStaticCSS) {
			let tmpLink = document.createElement("link");
			tmpLink.rel = "stylesheet";
			tmpLink.type = "text/css";
			tmpLink.href = chrome.runtime.getURL("static.css");
			document.head.appendChild(tmpLink);
			haveInsertedStaticCSS = true;
		}

		let tmpFrag = document.createDocumentFragment();
		//Insert any text between the start of the string and the first time occurrence
		tmpFrag.textContent = node.textContent.substr(0, timeInfo[0].matchPos);
		//Go through each time we need to replace
		timeInfo.forEach((thisTime, t) => {
		//for (let t = 0; t < timeInfo.length; t++) {
			//let thisTime = timeInfo[t];

			//Create a time to hold this converted time
			//We were using a span, but many websites have default span styling which might affect page flow
			let tmpTime = document.createElement("localisetime");
			tmpTime.setAttribute("class", "localiseTime");
			if (userSettings.includeClock) {
				tmpTime.appendChild(newClockElement(...thisTime.svgTimes));
			}

			//tmpTime.style.cursor = "pointer"; //Indicate that it's interactive
			//tmpTime.style.borderBottom = "1px dotted currentColor"; //Modest styling that should fit in with any content
			let tmpTimeText = document.createElement("span");
			tmpTimeText.textContent = thisTime.localisedTime;
			tmpTime.appendChild(tmpTimeText); //Our converted time
			//Let people mouse over the converted time to see what was actually written
			tmpTime.setAttribute("title", chrome.i18n.getMessage("tooltipConverted", thisTime.fullStr + (thisTime.usingManualTZ ? ' ' + manualTZ : '')));
			tmpTime.setAttribute("data-localised", thisTime.localisedTime); //Used when toggling
			tmpTime.setAttribute("data-original", thisTime.fullStr); //Used when toggling
			if (thisTime.usingManualTZ) {
				tmpTime.setAttribute("data-manualTZ", manualTZ); //Used when toggling
			}
			
			tmpFrag.appendChild(tmpTime);
			tmpTime.addEventListener("click", toggleTime);

			//Do we have any more times to worry about?
			const endPos = timeInfo[t + 1] ?
				//Yes - Insert a text node containing all the text between the end of the current time and the start of the next one
				timeInfo[t + 1].matchPos :
				//No - Fill in the remaining text
				node.textContent.length;
			tmpFrag.appendChild(document.createTextNode(node.textContent.substring(thisTime.matchPos + thisTime.fullStr.length, endPos)));

		})
		//replace the old text node with our mangled one
		node.parentElement.replaceChild(tmpFrag, node);
	}
}

function handleTextNode(node, timeInfo) {

	if (node.nodeType === 3) { node = node.parentNode; }

	//We use detection of a clock to help prevent these times from being localised more than once
	// So currently we are not obeying userSettings.includeClock
	//Hours: U+1F550 - U+1F55B
	//Half:  U+1F55C - U+1F567
	//Decimal range: 128336 - 128359

	if (!timeInfo) {
		timeInfo = spotTime(node.textContent);
	}

	if (timeInfo.length === 0) { return }

	const maybeClock = node.textContent.codePointAt(timeInfo[0][2] - 2);
	if (maybeClock && maybeClock >= 128336 && maybeClock <= 128359) { return }

	let newTextContent = node.textContent.substr(0, timeInfo[0].matchPos);

	timeInfo.forEach((thisTime, t) => {
		newTextContent += emojiClock(thisTime.svgTimes[0], thisTime.svgTimes[1]) +
			thisTime.localisedTime +
			node.textContent.substring(
				thisTime.matchPos + thisTime.fullStr.length,
				timeInfo[t + 1] ? timeInfo[t + 1].matchPos : node.textContent.length
			);
	})

	node.textContent = newTextContent;	
}

function emojiClock(hours, minutes) {
	const whichClock = 
		//Are we using the full hour or half hour version?
		((minutes <= 15 || minutes > 45) ? 0 : 12) +
		//Which hour is it?
		((hours % 12) || 12);

	return String.fromCodePoint(128335 + whichClock)
}

function toggleTime(e) {
	//Change the displayed time to and from the localised and original time
	if (!this || !this.hasAttribute("data-original") || !this.hasAttribute("data-localised")) {
		return;
	}

	//Which state are we in?
	if (this.getAttribute("data-original") == this.lastChild.textContent) {
		let manualTZStr = '';
		if (this.hasAttribute("data-manualTZ")) {
			manualTZStr = ' ' + this.getAttribute("data-manualTZ");
		}
		this.lastChild.textContent = this.getAttribute("data-localised");
		this.setAttribute("title", chrome.i18n.getMessage("tooltipConverted", this.getAttribute("data-original") + manualTZStr));
	} else {
		this.lastChild.textContent = this.getAttribute("data-original");
		this.setAttribute("title", chrome.i18n.getMessage("tooltipUnconverted", this.getAttribute("data-localised")));
	}

	//Stop any other events from firing (handy if this node is in a link)
	e.preventDefault();
}

function workOutShortHandOffsets() {
	//Work out the DST dates for the USA as part
	// of special casing for DST agnostic PT/ET
	//So first we need to get those dates
	//We're switching all of these times between at once, rather than staggering them correctly
	const thisYear = new Date().getUTCFullYear();

	//Begin DST
	//2nd Sunday in March (2am local, 7am UTC)
	let tmpDate = new Date(Date.UTC(thisYear, 2, 0, 7));
	tmpDate.setUTCMonth(2, (7 - tmpDate.getUTCDay()) + 7);
	const toDST = tmpDate.getTime();

	//End of DST
	//1st Sunday in November (2am local, 7am UTC)
	tmpDate = new Date(Date.UTC(thisYear, 10, 0, 7));
	tmpDate.setUTCMonth(10, 7 - tmpDate.getUTCDay());
	const fromDST = tmpDate.getTime();

	const tmpNow = Date.now();

	const dstAmerica = tmpNow > toDST && tmpNow < fromDST;
	
	//Now we need to fill in the correct offset for PT/ET
	userSettings.defaults.PT = dstAmerica ? defaultTZ.PDT : defaultTZ.PST;
	userSettings.defaults.ET = dstAmerica ? defaultTZ.EDT : defaultTZ.EST;
	userSettings.defaults.CT = dstAmerica ? defaultTZ.CDT : defaultTZ.CST;
	userSettings.defaults.MT = dstAmerica ? defaultTZ.MDT : defaultTZ.MST;
	//
}

function init() {
	workOutShortHandOffsets();

	//Give the page a once over now it has loaded
	if (userSettings.enabled) {
		lookForTimes();
	}

	//We need to watch for modifications to the document.body, so we can check for new text nodes to look at
	observer = new MutationObserver(handleMutations);
	if (userSettings.enabled) {
		observer.observe(document.body, {attributes: false, childList: true, subtree: true});
	}
}
function handleMutations(mutationsList, observer) {
	//Disconnect so we don't trigger mutations as we localise times
	observer.disconnect();

	let nodeList = [];
	mutationsList.forEach((mutation) => {
		//handle mutations here
		if (mutation.addedNodes.length > 0) {
			mutation.addedNodes.forEach(node => {
				if (node.nodeType === Node.TEXT_NODE) {
					if (node.nodeValue.trim().length > 0 &&
						node.parentNode && node.parentNode.tagName !== "TEXTAREA" && node.parentNode.tagName !== "SCRIPT" &&
						!(node.parentNode.parentNode && node.parentNode.parentNode.className === "localiseTime")) {
						handleTextNode(node);
					}
				} else {
					nodeList.push(node);
				}
			})
			//nodeList.push(...mutation.addedNodes);
		}
	});

	//I don't know why I can't just fiddle with stuff as I look at the mutation list but whatever
	nodeList.forEach((mNode) => {
		lookForTimes(mNode);
	});

	//Now it's time to restart the observer
	observer.observe(document.body, {attributes: false, childList: true, subtree: true});
}

//Listen for, and process, any relevant messages being passed from the popup menu (browser_action)
function contentMessageListener(request, sender, sendResponse) {
	if (!request.hasOwnProperty('mode')) { return }

	switch (request.mode) {
		case 'setManualTZ':
			manualTZ = request.selectedTZ;
			lookForTimes();
			break;

		case 'getManualTZ':
			sendResponse(manualTZ);
			break;

		case 'clearManualTZ':
			manualTZ = undefined;
			break;

		case 'sandbox':
			const correctedOffset = userSettings.defaults.hasOwnProperty(request.timezone) ? userSettings.defaults[request.timezone] : undefined;
			let timeInfo = spotTime(request.text, correctedOffset);

			sendResponse(timeInfo);
			break;

		case 'settings':
			//Reloads the users settings, to reflect any changes made.
			chrome.storage.local.get(defaultSettings, data => {
				userSettings = { defaults: { ...defaultSettings.defaults }, ...data };
				buildTimeRegex();
				workOutShortHandOffsets();
			});
			break;

		case 'enabled':
			userSettings.enabled = Boolean(request.enabled);

			if (userSettings.enabled) {
				observer.observe(document.body, {attributes: false, childList: true, subtree: true});
				lookForTimes();
			} else {
				observer.disconnect();
			}
			break;
	}
}
chrome.runtime.onMessage.addListener(contentMessageListener);

function spotTime(str, correctedOffset) {
	/*
		A well thought out version of this would take into account for info
		Such as words used in the tweet which might imply a date
		(Tomorrow, next week, today, on the 27th of sept)
		and also infer the timezone from the users settings/ip etc
		Probably other stuff too. It's GOOD to keep it simple though.
		Anyway, that info should be able create more accurate times.
		I'd say you could discount certain timezones (summer version/or normal in summer)
		  but people are terrible with timezones, so extra thought and care should be
		  taken when a user uses a timezone that isn't soon approaching/just passed
		  Perhaps they mean the other one.
		There is possibly some value in displaying the time as hours/minutes until, for shortly upcoming times.
		  Perhaps better displayed when you interact with the time.
		Have fun looking for written numbers (two forty, twenty to twelve)
		Also enjoy dealing with messages that list the same time but for different timezones like:
		  "blah will be at X PDT, Y EST, Z UTC"
	*/

	//Look for valid times, and return the string offsets
	/*NN TZ
	NN APM
	NN APM TZ
	NN:NN TZ
	NN:NN APM
	NN:NN APM TZ
	Also the above with an offset at the end like: +/- X
	It's way more than this list now.
	*/

	const matches = str.matchAll(timeRegex);

	let timeInfo = [];
	for (const match of matches) {

		let upperTZ = '';
		let usingManualTZ = false;
		if (match[_G.tzAbr]) {
			upperTZ = match[_G.tzAbr].toUpperCase();
		} else if (manualTZ) {
			//We need to be stricter on what times we detect when dealing with manual conversion
			//Otherwise we'll have a lot of false positives!
			if (!match[_G.mins] && !match[_G.meridiem]) { continue; }
			upperTZ = manualTZ;
			match[_G.tzAbr] = manualTZ;
			usingManualTZ = true;
		} else {
			continue;
		}

		//If a detected timezone abbreviation includes a space, then we've actually found a full name
		let fullNameOffset = false;
		if (match[_G.tzAbr].indexOf(" ") !== -1) {
			//To check if we've got a valid full name for a timezone,
			// we need to do a little bit of work
			const lcTZAbr = match[_G.tzAbr].toLowerCase();
			const longNameInfo = Object.keys(tzInfo).find(tzK => {
				return tzInfo[tzK].find(tzG => {
					if (tzG.title.toLowerCase() === lcTZAbr) {
						fullNameOffset = tzG.offset; 
						return tzG;
					}
				})
			})
			if (longNameInfo && fullNameOffset !== false) {
				match[_G.tzAbr] = longNameInfo;
				upperTZ = match[_G.tzAbr].toUpperCase();
			} else {
				//We didn't find the timezone in that list, but it might be a short hand name
				Object.keys(shortHandInfo).find(shK => {
					if (shortHandInfo[shK].toLowerCase() === lcTZAbr) {
						match[_G.tzAbr] = shK;
						upperTZ = shK;
						return true
					}
				})
			}
		}

		if (fullNameOffset === false) {
			//Check that we have a match, with a valid timezone.
			if (!match[_G.tzAbr] || typeof userSettings.defaults[upperTZ] === "undefined") { continue; }
			//Demand the timezone abbreviation be all the same case
			if (!(match[_G.tzAbr] === upperTZ || match[_G.tzAbr] === match[_G.tzAbr].toLowerCase())) { continue; }
			//Make sure the user isn't ignoring this abbreviation
			if (userSettings.ignored.indexOf(match[_G.tzAbr].toUpperCase()) !== -1) { continue; }

			//blank separator: Require : or . when minutes are given
			if (!match[_G.separator] && match[_G.mins] && !userSettings.blankSeparator) { continue; }

			//avoidMatchingFloatsManually: If we're manually converting times, ignore full stops used as time separators, with no meridiems (Can help avoid matching with numbers)
			if (match[_G.separator] === "." && match[_G.mins] && !match[_G.meridiem] && userSettings.avoidMatchingFloatsManually) { continue; }

			//We need to change the start of the regex to... maybe (^|\s)
			//The issue here is that : matches the word boundary, and if the input is "30:15 gmt" then it'll match "15 gmt"

			//if (str[match.index - 1] === ":" || str[match.index - 1] === ".") { continue; }
			//if (str.substr(match.index - 1, 1) === ":" || str.substr(match.index - 1, 1) === ".") { continue; }
			if (match.index > 0) {
				const prevChar = str.substr(match.index - 1, 1);
				if (preceedingRegEx.test(prevChar)) { continue; }
			}

			if (match[_G.tzAbr] === 'pt' && !(match[_G.meridiem] || match[_G.mins])) { continue; } //Temporary quirk to avoid matching font sizes

			if (match[_G.tzAbr] === 'ist' && !(match[_G.separator] || (match[_G.meridiem] && match[_G.meridiem] !== 'p'))) { continue; } //IST must be capitalised, if there's no separator
			//Only people with German in their first 3 accepted languages will use this path, it's to avoid issues with the word "ist"
			if (needsUppercaseIST && match[_G.tzAbr] === 'ist' && (!match[_G.meridiem] || match[_G.meridiem].length !== 2)) { continue; }

			//Avoid cat and eat false positives
			const requiresMeridiemOrMinsWithLowercase = ['cat', 'eat'];
			if (requiresMeridiemOrMinsWithLowercase.includes(match[_G.tzAbr]) && !(match[_G.meridiem] || match[_G.mins])) { continue; } 
			//if ((match[_G.tzAbr] !== 'CAT' || match[_G.tzAbr] !== 'EAT') && !(match[_G.meridiem] || match[_G.mins])) { continue; }

			const requiresSeparatorOrMeridiem = ['bit', 'mit'];
			if (requiresSeparatorOrMeridiem.includes(match[_G.tzAbr]) && !(match[_G.separator] || match[_G.meridiem])) { continue; }
			//Manually converted times will easily match numbers without this
			if (usingManualTZ && !(match[_G.separator] || match[_G.meridiem])) { continue; }
		}

		let tHour = parseInt(match[_G.hours]);
		if (tHour == 0 && !match[_G.mins]) { continue; } //Bail if the hour is 0 and we have no minutes. (We could assume midnight)
		if (match[_G.meridiem]) {
			tHour = (12 + tHour) % 12;
			if (match[_G.meridiem][0].toLowerCase() == 'p') {
				tHour += 12;
			}
		} else if (match[_G.startHour] && tHour < 12 && tHour < match[_G.startHour]) {
			//Non-exhaustive tHour/startHour test - This probably needs fleshing out?
			tHour += 12;
		} else if (tHour > 0 && tHour < 13 && !match[_G.meridiem] && !match[_G.mins]) {
			//Skip this time if the hour is 1-12, and it lacks a meridiem and minutes
			// Because it's a vague time.
			continue;
		}
		// I feel like we should handle mixed 12/24 hour times, in time ranges.
		// "7pm - 21:00 UTC" looks really strange, but is currently valid.

		let tMins = match[_G.mins] ? parseInt(match[_G.mins]) : 0;
		let tMinsFromMidnight = h2m(tHour, tMins);
		let hourOffset = 0;
		//Sometimes people write a tz and then +X (like UTC+1)
		if (match[_G.offset]) {
			hourOffset = parseInt(match[_G.offset].replace(whiteSpaceRegEx, '')) * 60;
		}
		const mainOffset = (fullNameOffset !== false ? fullNameOffset : userSettings.defaults[upperTZ]) + hourOffset;
		let tCorrected = tMinsFromMidnight - mainOffset;
		if (correctedOffset) {
			tCorrected += correctedOffset;
		} else {
			tCorrected -= dateObj.getTimezoneOffset();
		}

		if (tCorrected < 0) { tCorrected += 1440; }

		//Build the localised time
		let tmpExplode = m2h(tCorrected);
		let tmpDate = new Date(
			dateObj.getUTCFullYear(),
			dateObj.getUTCMonth(),
			dateObj.getUTCDate(),
			tmpExplode[0],
			tmpExplode[1],
			match[_G.seconds] ? match[_G.seconds].substring(1) : 0
		);
		if (isNaN(tmpDate)) {
			console.log(`Localise Times: Invlaid date time created for "${match[_G.fullStr]}"`);
			continue;
		}
		let localeTimeString = formatLocalisedTime(tmpDate, match[_G.seconds])

		let SVGTimes = [ ...tmpExplode ];

		let localeStartTimeString = '';

		let validMidnight = true;
		//0 is only accepted as a start hour if no meridiems are used, so we're reasonably certain it's a 24hour time.
		if (match[_G.startHour]) {
			if (+match[_G.startHour] === 0) {
				validMidnight = !match[_G.meridiem] && !match[_G.startMeridiem];
			}
		}

		if (match[_G.startHour] && validMidnight) {

			//This is a time range
			//Can we avoid duplicate code?
			let startHour = +match[_G.startHour];

			if (match[_G.startMeridiem]) {
				startHour = (12 + startHour) % 12;
				if (match[_G.startMeridiem][0].toLowerCase() == 'p') {
					startHour += 12;
				}
			} else if (match[_G.meridiem]) {
				let tmpStartHour = (12 + startHour) % 12;
				if (match[_G.meridiem][0].toLowerCase() == 'p') {
					tmpStartHour += 12;
				}
				//Make sure we haven't just made the start time later than the end
				if (tmpStartHour < tHour) {
					startHour = tmpStartHour;
				}
			}
			//if (startHour > tHour) { console.warn("Invalid time range.", startHour, tHour); }
			let startMins = match[_G.startMins] ? +match[_G.startMins] : 0;
			let startMinsFromMidnight = h2m(startHour, startMins);

			let startCorrected = startMinsFromMidnight - mainOffset;
			startCorrected -= dateObj.getTimezoneOffset();

			if (startCorrected < 0) { startCorrected += 1440; }

			//Build the localised time
			let tmpExplode = m2h(startCorrected);
			let tmpDate = new Date(
				dateObj.getUTCFullYear(),
				dateObj.getUTCMonth(),
				dateObj.getUTCDate(),
				tmpExplode[0],
				tmpExplode[1],
				match[_G.startSeconds] ? match[_G.startSeconds].substring(1) : 0
			);
			if (isNaN(tmpDate)) {
				console.log(`Localise Times: Invlaid date time created for "${match[_G.fullStr]}"`);
				continue;
			}
			//It would be nice to avoid including the meridiem if it's the same as the main time
			let timeSeparator = match[_G.timeSeparator].length === 1 ? "–" : match[_G.timeSeparator];
			//Match the granularity of the output to the input
			localeStartTimeString = formatLocalisedTime(tmpDate, match[_G.startSeconds]) + " " + timeSeparator + " ";//' – ';
			//Should we capture the user defined separator and reuse it? - Yes, and we are now.

			SVGTimes = [ ...tmpExplode ];
		}

		//Store the localised time, the time that we matched, its offset and length
		timeInfo.push({
			localisedTime: localeStartTimeString + localeTimeString,
			fullStr: match[_G.fullStr],
			matchPos: match.index,
			usingManualTZ: usingManualTZ,
			svgTimes: SVGTimes
		});
	}

	return timeInfo;
}
function m2h(mins) {
	mins = Math.abs(mins);
	let h = Math.floor(mins / 60) % 24;
	let m = mins % 60;
	return [h, m];
}
function h2m(hours, mins) {
	return (hours * 60) + mins;
}

const hour12 = [{}, { hour12: true }, { hour12: false }]
function formatLocalisedTime(tmpDate, withSeconds) {
	// Lazily create the DateTimeFormat object that we need
	if (withSeconds && !dateTimeFormats[1]) {
		dateTimeFormats[1] = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: 'numeric', second: 'numeric', ...hour12[userSettings.timeFormat] });
	} else if (!dateTimeFormats[0]) {
		dateTimeFormats[0] = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: 'numeric', ...hour12[userSettings.timeFormat] });
	}
	// Match the granularity of the output to the input
	return dateTimeFormats[withSeconds ? 1 : 0].format(tmpDate)	
}

function buildClockElement() {
	if (clockEle) {
		return clockEle.cloneNode(true);
	}

	const xmlns = "http://www.w3.org/2000/svg";

	clockEle = document.createElementNS(xmlns, "svg");
	clockEle.setAttributeNS(null, "viewBox", "0 0 16 16");
	clockEle.setAttributeNS(null, "width", ".8em");

	let g = document.createElementNS(xmlns, "g");
	g.setAttributeNS(null, "fill", "none");
	g.setAttributeNS(null, "stroke", "currentColor");
	g.setAttributeNS(null, "stroke-width", 1.5);

	let circle = document.createElementNS(xmlns, "circle");
	circle.setAttributeNS(null, "cx", 8);
	circle.setAttributeNS(null, "cy", 8);
	circle.setAttributeNS(null, "r", 7.25);
	circle.setAttributeNS(null, "stroke-linejoin", "round");
	g.appendChild(circle);

	let path = document.createElementNS(xmlns, "path");
	path.setAttributeNS(null, "stroke-linecap", "round");
	path.setAttributeNS(null, "stroke-linejoin", "round");
	path.setAttributeNS(null, "d", "M8 3v5m2.31 1.91L8 8");
	g.appendChild(path);

	clockEle.appendChild(g);

	return clockEle.cloneNode(true);
}

function newClockElement(inHours = 4, inMinutes = 0, inSeconds = 0) {
	const newClock = buildClockElement();

	const hour = ((inHours % 12) * Math.PI / 6) + (inMinutes * Math.PI / (6 * 60)) + (inSeconds * Math.PI / (360 * 60)) - (Math.PI / 2);
	const minute = (inMinutes * Math.PI / 30) + (inSeconds * Math.PI / (30 * 60)) - (Math.PI / 2);

	const newPath = `M${Math.cos(hour) * 3 + 8} ${Math.sin(hour) * 3 + 8}L8 8L${Math.cos(minute) * 5 + 8} ${Math.sin(minute) * 5 + 8}`;

	newClock.children[0].children[1].setAttribute("d", newPath);

	return newClock;
}