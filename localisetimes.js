"use strict";
//PHP spat these timezone abbreviations out, and their offsets - There could be some missing
const tzaolObj = {"GMT":0,"EAT":180,"CET":60,"WAT":60,"CAT":120,"EET":120,"WEST":60,"WET":0,"CEST":120,"SAST":120,"HDT":-540,"HST":-600,"AKDT":-480,"AKST":-540,"AST":-240,"EST":-300,"CDT":-300,"CST":-360,"MDT":-360,"MST":-420,"PDT":-420,"PST":-480,"EDT":-240,"ADT":-180,"NST":-210,"NDT":-150,"NZST":720,"NZDT":780,"EEST":180,"HKT":480,"WIB":420,"WIT":540,"IDT":180,"IST":120,"PKT":300,"WITA":480,"KST":510,"JST":540,"ACST":570,"ACDT":630,"AEST":600,"AEDT":660,"AWST":480,"BST":60,"MSK":180,"SST":-660,"UTC":0,"PT":0,"ET":0,"MT":0,"CT":0};
const tzaolStr = Object.keys(tzaolObj).join("|");

const timeRegex = new RegExp('\\b(?:([01]?[0-9]|2[0-3])((:|\\.)[0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?))? ?[-\u2010-\u2015] ?\\b)?([01]?[0-9]|2[0-3])((:|\\.)[0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?) )?(?: ?(' + tzaolStr + '))( ?(?:\\+|-) ?[0-9]{1,2})?\\b', 'giu');
//[-|\\u{8211}|\\u{8212}|\\u{8213}]
//Match group enumeration
const _G = {
	fullStr: 0,

	startHour: 1,
	startMinsIncSep: 2,
	startSeparator: 3,
	startSeconds: 4,
	startMeridiem: 5,

	hours: 6,
	minsIncSep: 7,
	separator: 8,
	seconds: 9,
	meridiem: 10,
	tzAbr: 11,
	offset: 12
};

const timeWithoutTZRegex = new RegExp('\\b(?:([01]?[0-9]|2[0-3])((:|\\.)[0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?))? ?[-\u2010-\u2015] ?\\b)?([01]?[0-9]|2[0-3])((:|\\.)[0-5][0-9])?(:[0-5][0-9])?(?: ?([ap]\\.?m?\\.?))?\\b', 'giu');

const whiteSpaceRegEx = /\s/g;

function lookForTimes(node = document.body, manualTZ) {
	//Walk the dom looking for text nodes
	var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);

	var nodes = [];

	while(walker.nextNode()) {
		nodes.push(walker.currentNode);
	}

	const dateObj = new Date();

	for(var i = 0; node=nodes[i] ; i++) {

		//If we're manually converting times then avoid any existing times that have been converted
		if (manualTZ && node.parentElement.hasAttribute("data-localised")) { continue; }

		//Ignore any text nodes that are purely white space
		if (node.nodeValue.trim().length === 0) { continue; }

		//Look at each text node, and try and find valid times
		let timeInfo = spotTime(node.nodeValue, dateObj, manualTZ);
		//We get an array back, if it has stuff in it then take action
		if (timeInfo.length === 0) { continue; }

		let tmpFrag = document.createDocumentFragment();
		//Insert any text between the start of the string and the first time occurrence
		tmpFrag.textContent = node.textContent.substr(0, timeInfo[0][2]);
		//Go through each time we need to replace
		for (let t = 0; t < timeInfo.length; t++) {
			let thisTime = timeInfo[t];

			//Create a time to hold this converted time
			//We were using a span, but many websites have default span styling which might affect page flow
			let tmpTime = document.createElement("time");
			tmpTime.style.cursor = "pointer"; //Indicate that it's interactive
			tmpTime.style.borderBottom = "1px dotted currentColor"; //Modest styling that should fit in with any content
			tmpTime.textContent = thisTime[0]; //Our converted time
			//Let people mouse over the converted time to see what was actually written
			tmpTime.setAttribute("title", 'Converted to your local time from "' + thisTime[1] + (manualTZ ? ' ' + manualTZ : '') + '"');
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

		}
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
	if (this.getAttribute("data-original") == this.textContent) {
		let manualTZStr = '';
		if (this.hasAttribute("data-manualTZ")) {
			manualTZStr = ' ' + this.getAttribute("data-manualTZ");
		}
		this.textContent = this.getAttribute("data-localised");
		this.setAttribute("title", 'Converted to your local time from "' + this.getAttribute("data-original") + manualTZStr + '"');
	} else {
		this.textContent = this.getAttribute("data-original");
		this.setAttribute("title", 'Converted to your local time this is "' + this.getAttribute("data-localised") + '"');
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
	tzaolObj.PT = dstAmerica ? tzaolObj.PDT : tzaolObj.PST;
	tzaolObj.ET = dstAmerica ? tzaolObj.EDT : tzaolObj.EST;
	tzaolObj.CT = dstAmerica ? tzaolObj.CDT : tzaolObj.CST;
	tzaolObj.MT = dstAmerica ? tzaolObj.MDT : tzaolObj.MST;
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

init();

//Listen for, and process, any relevant messages being passed from the popup menu (browser_action)
function contentMessageListener(request, sender, sendResponse) {
	if (!request.convert) { return }
	lookForTimes(document.body, request.convert);
}
browser.runtime.onMessage.addListener(contentMessageListener);

function spotTime(str, dateObj, manualTZ) {
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
			if (!match[_G.minsIncSep] && !match[_G.meridiem]) { continue; }
			upperTZ = manualTZ;
			match[_G.tzAbr] = manualTZ;
		} else {
			upperTZ = match[_G.tzAbr].toUpperCase();
		}

		//Check that we have a match, with a valid timezone.
		if (!match[_G.tzAbr] || typeof tzaolObj[upperTZ] == "undefined") { continue; }
		//Demand the timezone abbreviation be all the same case
		if (!(match[_G.tzAbr] === upperTZ || match[_G.tzAbr] === match[_G.tzAbr].toLowerCase())) { continue; }

		//We need to change the start of the regex to... maybe (^|\s)
		//The issue here is that : matches the word boundary, and if the input is "30:15 gmt" then it'll match "15 gmt"

		if (str[match.index - 1] === ":" || str[match.index - 1] === ".") { continue; }

		if (match[_G.tzAbr] === 'pt' && !(match[_G.meridiem] || match[_G.minsIncSep])) { continue; } //Temporary quirk to avoid matching font sizes

		let tHour = +match[_G.hours];
		if (tHour == 0 && !match[_G.minsIncSep]) { continue; } //Bail if the hour is 0 and we have no minutes. (We could assume midnight)
		if (match[_G.meridiem]) {
			tHour = (12 + tHour) % 12;
			if (match[_G.meridiem][0].toLowerCase() == 'p') {
				tHour += 12;
			}
		} else if (match[_G.startHour] && tHour < 12 && tHour < match[_G.startHour]) {
			//Non-exhaustive tHour/startHour test - This probably needs fleshing out?
			tHour += 12;
		}
		let tMins = (match[_G.minsIncSep] ? match[_G.minsIncSep] : ':00');
		let tMinsFromMidnight = h2m(tHour + tMins, match[_G.separator]);
		let hourOffset = 0;
		//Sometimes people write a tz and then +X (like UTC+1)
		if (match[_G.offset]) {
			hourOffset = -(match[_G.offset].replace(whiteSpaceRegEx, '')) * 60;
		}
		let tCorrected = tMinsFromMidnight - tzaolObj[upperTZ] + hourOffset;
		tCorrected -= dateObj.getTimezoneOffset();
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
		//Match the granularity of the output to the input
		let timeFormat = { hour: 'numeric', minute: 'numeric' };
		if (match[_G.seconds]) {
			timeFormat.second = 'numeric';
		}
		let localeTimeString = tmpDate.toLocaleTimeString(
			undefined, timeFormat
		);

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
			let startMins = (match[_G.startMinsIncSep] ? match[_G.startMinsIncSep] : ':00');
			let startMinsFromMidnight = h2m(startHour + startMins, match[_G.startSeparator]);

			let startCorrected = startMinsFromMidnight - tzaolObj[upperTZ] + hourOffset;
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
			let timeFormat = { hour: 'numeric' };
			if (match[_G.startMinsIncSep]) {
				timeFormat.minute = 'numeric';
			}
			if (match[_G.startSeconds]) {
				timeFormat.second = 'numeric';
			}
			//It would be nice to avoid including the meridiem if it's the same as the main time
			localeStartTimeString = tmpDate.toLocaleTimeString(
				undefined, timeFormat
			) + ' – ';
			//Should we capture the user defined separator and reuse it?
		}

		//Store the localised time, the time that we matched, its offset and length
		timeInfo.push([localeStartTimeString + localeTimeString, match[_G.fullStr], match.index, match[_G.fullStr].length]);
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
function h2m(hours, separator = ':') {
	var t = (String)(hours).split(separator);
	var tmp = (t[0] * 60) + +t[1];
	return tmp;
}