"use strict";

let dateTimeFormats = Array(2);
//PHP spat these timezone abbreviations out, and their offsets - There could be some missing
const defaultTZ = {"ACDT":630,"ACST":570,"ACT":-300,"ACWST":525,"ADT":-180,"AEDT":660,"AEST":600,"AET":600,"AFT":270,"AKDT":-480,"AKST":-540,"AMST":-180,"AMT":-240,"ART":-180,"AST":180,"AWST":480,"AZOST":0,"AZOT":-60,"AZT":240,"BNT":480,"BIOT":360,"BIT":-720,"BOT":-240,"BRST":-120,"BRT":-180,"BST":60,"BTT":360,"CAT":120,"CCT":390,"CDT":-300,"CEST":120,"CET":60,"CHADT":825,"CHAST":765,"CHOT":480,"CHOST":540,"CHST":600,"CHUT":600,"CIST":480,"CKT":-600,"CLST":-180,"CLT":-240,"COST":-240,"COT":-300,"CST":-360,"CT":-360,"CVT":-60,"CWST":525,"CXT":420,"DAVT":420,"EASST":-300,"EAST":-360,"EAT":180,"ECT":-240,"EDT":-240,"EEST":180,"EET":120,"EGST":0,"EGT":-60,"EST":-300,"ET":-300,"FET":180,"FJT":720,"FKST":-180,"FKT":-240,"FNT":-120,"GALT":-360,"GAMT":-540,"GET":240,"GFT":-180,"GILT":720,"GIT":-540,"GMT":0,"GST":-120,"GYT":-240,"HDT":-540,"HAEC":120,"HST":-600,"HKT":480,"HMT":300,"ICT":420,"IDLW":-720,"IDT":180,"IOT":180,"IRDT":270,"IRKT":480,"IRST":210,"IST":330,"JST":540,"KALT":120,"KGT":360,"KOST":660,"KRAT":420,"KST":540,"LINT":840,"MAGT":720,"MART":-570,"MDT":-360,"MET":60,"MEST":120,"MHT":720,"MIT":-570,"MMT":390,"MSK":180,"MST":480,"MUT":240,"MVT":300,"MYT":480,"NCT":660,"NDT":-150,"NFT":660,"NPT":345,"NST":-210,"NT":-210,"NUT":-660,"NZDT":780,"NZST":720,"OMST":360,"PDT":-420,"PET":-300,"PETT":720,"PGT":600,"PHOT":780,"PHT":480,"PHST":480,"PKT":300,"PMDT":-120,"PMST":-180,"PONT":660,"PST":-480,"PYST":-180,"PYT":-240,"RET":240,"SAKT":660,"SAMT":240,"SAST":120,"SBT":660,"SCT":240,"SDT":-600,"SGT":480,"SLST":330,"SRET":660,"SRT":-180,"SST":-660,"TAHT":-600,"THA":420,"TJT":300,"TKT":780,"TLT":540,"TMT":300,"TRT":180,"TOT":780,"TVT":720,"ULAST":540,"ULAT":480,"UTC":0,"UYST":-120,"UYT":-180,"UZT":300,"VET":-240,"VLAT":600,"VOLT":240,"VUT":660,"WAKT":720,"WAST":120,"WAT":60,"WEST":60,"WET":0,"WIB":420,"WIT":540,"WITA":480,"WST":480,"YAKT":540,"YEKT":300};

let timeRegex;

//Match group enumeration
const _G = {
	fullStr: 0,

	startHour: 1,
	startSeparator: 2,
	startMins: 3,
	startSeconds: 4,
	startMeridiem: 5,

	timeSeparator: 6,

	hours: 7,
	separator: 8,
	mins: 9,
	seconds: 10,
	meridiem: 11,
	tzAbr: 12,
	offset: 13
};

const timeWithoutTZRegex = new RegExp('\\b(?:([01]?[0-9]|2[0-3])(:|\\.)?([0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?))? ?(to|until|til|and|[-\u2010-\u2015]) ?\\b)?([01]?[0-9]|2[0-3])(:|\\.)?([0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?))?\\b', 'giu');

const whiteSpaceRegEx = /\s/g;

let haveInsertedStaticCSS = false;

let clockEle;

//Check the users (first 3) accepted languages, if one is German, then enforce IST being in upper case only as a time zone abbreviation.
const needsUppercaseIST = typeof window === "undefined" ? false : navigator.languages.findIndex((l,i) => i < 3 && l.split("-")[0] === "de") !== -1


const defaultSettings = {
	defaults: { ...defaultTZ },
	timeFormat: 0,
	includeClock: true
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
	const tzaolStr = Object.keys(userSettings.defaults).join("|");
	timeRegex = new RegExp('\\b(?:([01]?[0-9]|2[0-3])(:|\\.)?([0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?))? ?(to|until|til|and|[-\u2010-\u2015]) ?\\b)?([01]?[0-9]|2[0-3])(:|\\.)?([0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?) )?(?: ?(' + tzaolStr + '))( ?(?:\\+|-) ?[0-9]{1,2})?\\b', 'giu');
	//[-|\\u{8211}|\\u{8212}|\\u{8213}]
}


function lookForTimes(node = document.body, manualTZ) {
	//Walk the dom looking for text nodes
	var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);

	var nodes = [];

	while(walker.nextNode()) {
		nodes.push(walker.currentNode);
	}

	const dateObj = new Date();

	for(var i = 0; node=nodes[i] ; i++) {

		//We should try and avoid working inside contenteditable="true" elements, as it could cause issues for the user
		//I'm going to assume that they don't get horribly nested, so only check up a few nodes.
		let tmpNode = node;
		let nodeCount = 0;
		let skipThis = false;
		while (tmpNode && tmpNode.parentNode && tmpNode !== document.body && nodeCount < 5) {
			if (tmpNode.parentNode.hasAttribute("contenteditable")) {
				skipThis = true;
				break;
			}
			tmpNode = tmpNode.parentNode;
			nodeCount++;
		}
		if (skipThis) { continue; }

		//If we're manually converting times then avoid any existing times that have been converted
		if (manualTZ && node.parentElement.parentElement.hasAttribute("data-localised")) { continue; }

		//Ignore any text nodes that are purely white space
		if (node.nodeValue.trim().length === 0) { continue; }

		//Look at each text node, and try and find valid times
		let timeInfo = spotTime(node.nodeValue, dateObj, manualTZ);
		//We get an array back, if it has stuff in it then take action
		if (timeInfo.length === 0) { continue; }

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
		tmpFrag.textContent = node.textContent.substr(0, timeInfo[0][2]);
		//Go through each time we need to replace
		timeInfo.forEach((thisTime, t) => {
		//for (let t = 0; t < timeInfo.length; t++) {
			//let thisTime = timeInfo[t];

			//Create a time to hold this converted time
			//We were using a span, but many websites have default span styling which might affect page flow
			let tmpTime = document.createElement("localisetime");
			tmpTime.setAttribute("class", "localiseTime");
			if (userSettings.includeClock) {
				tmpTime.appendChild(newClockElement(thisTime[4], thisTime[5]));
			}

			//tmpTime.style.cursor = "pointer"; //Indicate that it's interactive
			//tmpTime.style.borderBottom = "1px dotted currentColor"; //Modest styling that should fit in with any content
			let tmpTimeText = document.createElement("span");
			tmpTimeText.textContent = thisTime[0];
			tmpTime.appendChild(tmpTimeText); //Our converted time
			//Let people mouse over the converted time to see what was actually written
			tmpTime.setAttribute("title", chrome.i18n.getMessage("tooltipConverted", thisTime[1] + (manualTZ ? ' ' + manualTZ : '')));
			tmpTime.setAttribute("data-localised", thisTime[0]); //Used when toggling
			tmpTime.setAttribute("data-original", thisTime[1]); //Used when toggling
			if (manualTZ) {
				tmpTime.setAttribute("data-manualTZ", manualTZ); //Used when toggling
			}
			
			tmpFrag.appendChild(tmpTime);
			tmpTime.addEventListener("click", toggleTime);

			//Do we have any more times to worry about?
			if (timeInfo[t + 1]) {
				//Yes
				//Insert a text node containing all the text between the end of the current time and the start of the next one
				tmpFrag.appendChild(document.createTextNode(node.textContent.substring(thisTime[2] + thisTime[3], timeInfo[t + 1][2])));
			} else {
				//No
				//Fill in the remaining text
				tmpFrag.appendChild(document.createTextNode(node.textContent.substring(thisTime[2] + thisTime[3])));
			}

		})
		//replace the old text node with our mangled one
		node.parentElement.replaceChild(tmpFrag, node);
	}
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
function init() {
	//Work out the DST dates for the USA as part
	// of special casing for DST agnostic PT/ET
	//So first we need to get those dates (We could hard code them)
	const thisYear = new Date().getUTCFullYear();
	let tmpDate = new Date(Date.UTC(thisYear, 2, 0));
	//Work out the day
	let tmpDay = ((6 - tmpDate.getDay()) + 7) % 7;
	//2am on the second Sunday in March
	const toDST = Date.UTC(thisYear, 2, tmpDay, 2);
	//End of DST
	tmpDate = new Date(Date.UTC(thisYear, 10, 0));
	//Work out the day
	tmpDay = (6 - tmpDate.getDay()) % 7;
	//2am on the 1st Sunday in November
	const fromDST = Date.UTC(thisYear, 10, tmpDay, 2);
	//
	const tmpNow = Date.now();
	const dstAmerica = tmpNow >= toDST && tmpNow <= fromDST;
	//Now we need to fill in the correct offset for PT/ET
	userSettings.defaults.PT = dstAmerica ? defaultTZ.PDT : defaultTZ.PST;
	userSettings.defaults.ET = dstAmerica ? defaultTZ.EDT : defaultTZ.EST;
	userSettings.defaults.CT = dstAmerica ? defaultTZ.CDT : defaultTZ.CST;
	userSettings.defaults.MT = dstAmerica ? defaultTZ.MDT : defaultTZ.MST;
	//

	//Give the page a once over now it has loaded
	lookForTimes();

	//We need to watch for modifications to the document.body, so we can check for new text nodes to look at
	const observer = new MutationObserver(handleMutations);
	observer.observe(document.body, {attributes: false, childList: true, subtree: true});
}
function handleMutations(mutationsList, observer) {
	//Disconnect so we don't trigger mutations as we localise times
	observer.disconnect();

	let nodeList = [];
	mutationsList.forEach((mutation) => {
		//handle mutations here
		if (mutation.addedNodes.length > 0) {
			nodeList.push(mutation.addedNodes[0]);
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
		case 'convert':
			lookForTimes(document.body, request.selectedTZ);
			break;
		case 'sandbox':
			const correctedOffset = userSettings.defaults.hasOwnProperty(request.timezone) ? userSettings.defaults[request.timezone] : undefined;
			let timeInfo = spotTime(request.text, new Date(), undefined, correctedOffset);

			sendResponse(timeInfo);
			break;
	}
}
chrome.runtime.onMessage.addListener(contentMessageListener);

function spotTime(str, dateObj, manualTZ, correctedOffset) {
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

	let matches = [];
	if (manualTZ) {
		matches = str.matchAll(timeWithoutTZRegex);
	} else {
		matches = str.matchAll(timeRegex);
	}

	let timeInfo = [];
	for (const match of matches) {

		let upperTZ = '';
		if (manualTZ) {
			//We need to be stricter on what times we detect when dealing with manual conversion
			//Otherwise we'll have a lot of false positives!
			if (!match[_G.mins] && !match[_G.meridiem]) { continue; }
			upperTZ = manualTZ;
			match[_G.tzAbr] = manualTZ;
		} else {
			upperTZ = match[_G.tzAbr].toUpperCase();
		}

		//Check that we have a match, with a valid timezone.
		if (!match[_G.tzAbr] || typeof userSettings.defaults[upperTZ] === "undefined") { continue; }
		//Demand the timezone abbreviation be all the same case
		if (!(match[_G.tzAbr] === upperTZ || match[_G.tzAbr] === match[_G.tzAbr].toLowerCase())) { continue; }

		//We need to change the start of the regex to... maybe (^|\s)
		//The issue here is that : matches the word boundary, and if the input is "30:15 gmt" then it'll match "15 gmt"

		//if (str[match.index - 1] === ":" || str[match.index - 1] === ".") { continue; }
		if (str.substr(match.index - 1, 1) === ":" || str.substr(match.index - 1, 1) === ".") { continue; }

		if (match[_G.tzAbr] === 'pt' && !(match[_G.meridiem] || match[_G.mins])) { continue; } //Temporary quirk to avoid matching font sizes

		if (match[_G.tzAbr] === 'ist' && !(match[_G.separator] || (match[_G.meridiem] && match[_G.meridiem] !== 'p'))) { continue; } //IST must be capitalised, if there's no separator
		//Only people with German in their first 3 accepted languages will use this path, it's to avoid issues with the word "ist"
		if (needsUppercaseIST && match[_G.tzAbr] === 'ist' && (!match[_G.meridiem] || match[_G.meridiem].length !== 2)) { continue; }

		//Avoid cat and eat false positives
		if ((match[_G.tzAbr] !== 'CAT' || match[_G.tzAbr] !== 'EAT') && !(match[_G.meridiem] || match[_G.mins])) { continue; }
		if (match[_G.tzAbr] === 'bit' && !(match[_G.separator] || match[_G.meridiem])) { continue; }

		let tHour = +match[_G.hours];
		if (tHour == 0 && !match[_G.mins]) { continue; } //Bail if the hour is 0 and we have no minutes. (We could assume midnight)
		if (match[_G.meridiem]) {
			tHour = (12 + tHour) % 12;
			if (match[_G.meridiem][0].toLowerCase() == 'p') {
				tHour += 12;
			}
		} else if (match[_G.startHour] && tHour < 12 && tHour < match[_G.startHour]) {
			//Non-exhaustive tHour/startHour test - This probably needs fleshing out?
			tHour += 12;
		}
		let tMins = (match[_G.mins] ? match[_G.mins] : 0);
		let tMinsFromMidnight = h2m(tHour, tMins);
		let hourOffset = 0;
		//Sometimes people write a tz and then +X (like UTC+1)
		if (match[_G.offset]) {
			hourOffset = -(match[_G.offset].replace(whiteSpaceRegEx, '')) * 60;
		}
		let tCorrected = tMinsFromMidnight - userSettings.defaults[upperTZ] + hourOffset;
		if (correctedOffset) {
			tCorrected += correctedOffset;
		} else {
			tCorrected -= dateObj.getTimezoneOffset();
		}

		if (tCorrected < 0) { tCorrected += 1440; }
		//Build the localised time
		let tmpExplode = m2h(tCorrected).split(":");
		let tmpDate = new Date(
			dateObj.getFullYear(),
			dateObj.getMonth(),
			dateObj.getDay(),
			tmpExplode[0],
			tmpExplode[1],
			match[_G.seconds] ? match[_G.seconds].substring(1) : 0
		);
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
			let startMins = (match[_G.startMins] ? match[_G.startMins] : 0);
			let startMinsFromMidnight = h2m(startHour, startMins);

			let startCorrected = startMinsFromMidnight - userSettings.defaults[upperTZ] + hourOffset;
			startCorrected -= dateObj.getTimezoneOffset();

			//Build the localised time
			let tmpExplode = m2h(startCorrected).split(":");
			let tmpDate = new Date(
				dateObj.getFullYear(),
				dateObj.getMonth(),
				dateObj.getDay(),
				tmpExplode[0],
				tmpExplode[1],
				match[_G.startSeconds] ? match[_G.startSeconds].substring(1) : 0
			);
			//Match the granularity of the output to the input
			let timeFormat = { hour: 'numeric', minute: 'numeric' };
			/*if (match[_G.startMins]) {
				timeFormat.minute = 'numeric';
			}*/
			if (match[_G.startSeconds]) {
				timeFormat.second = 'numeric';
			}
			//It would be nice to avoid including the meridiem if it's the same as the main time
			let timeSeparator = match[_G.timeSeparator].length === 1 ? "–" : match[_G.timeSeparator];
			localeStartTimeString = formatLocalisedTime(tmpDate, match[_G.startSeconds]) + " " + timeSeparator + " ";//' – ';
			//Should we capture the user defined separator and reuse it? - Yes, and we are now.

			SVGTimes = [ ...tmpExplode ];
		}

		//Store the localised time, the time that we matched, its offset and length
		timeInfo.push([localeStartTimeString + localeTimeString, match[_G.fullStr], match.index, match[_G.fullStr].length, ...SVGTimes]);
	}

	return timeInfo;
}
function m2h(mins) {
	mins = Math.abs(mins);
	var h = Math.floor(mins / 60);
	if (h > 23) { h = h - 24 + ''; } else { h += ''; }
	var m = (mins % 60) + '';
	while (h.length < 2) { h = '0' + h; }
	while (m.length < 2) { m = '0' + m; }
	var tmp = h + ":" + m;
	return tmp;
}
function h2m(hours, mins) {
	return (+hours * 60) + +mins;
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