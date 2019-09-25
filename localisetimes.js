"use strict";
//PHP spat these timezone abbreviations out, and their offsets - There could be some missing
const tzaolObj = {"GMT":0,"EAT":180,"CET":60,"WAT":60,"CAT":120,"EET":120,"WEST":60,"WET":0,"CEST":120,"SAST":120,"HDT":-540,"HST":-600,"AKDT":-480,"AKST":-540,"AST":-240,"EST":-300,"CDT":-300,"CST":-360,"MDT":-360,"MST":-420,"PDT":-420,"PST":-480,"EDT":-240,"ADT":-180,"NDT":-90,"NST":-150,"NZST":720,"NZDT":780,"EEST":180,"HKT":480,"WIB":420,"WIT":540,"IDT":180,"IST":120,"PKT":300,"WITA":480,"KST":510,"JST":540,"ACST":570,"ACDT":630,"AEST":600,"AEDT":660,"AWST":480,"BST":60,"MSK":180,"SST":-660,"UTC":0,"PT":0,"ET":0,"MT":0,"CT":0};
const tzaolStr = Object.keys(tzaolObj).join("|");
const timeRegex = new RegExp('\\b([0-2]*[0-9])((:|\.)[0-5][0-9])?(?: ?([ap](?:\.?m\.?)?))?(?: ?(' + tzaolStr + '))( ?(?:\\+|-) ?[0-9]{1,2})?\\b', 'gi');

function lookForTimes(node = document.body) {
	//Walk the dom looking for text nodes
	var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);

	var nodes = [];

	while(walker.nextNode()) {
		nodes.push(walker.currentNode);
	}

	const dateObj = new Date();

	for(var i = 0; node=nodes[i] ; i++) {
		//Look at each text node, and try and find valid times
		let timeInfo = spotTime(node.nodeValue, dateObj);
		//We get an array back, if it has stuff in it then take action
		if (timeInfo.length === 0) { continue }

		let tmpFrag = document.createDocumentFragment();
		//Insert any text between the start of the string and the first time occurrence
		tmpFrag.textContent = node.textContent.substr(0, timeInfo[0][2]);
		//Go through each time we need to replace
		for (let t = 0; t < timeInfo.length; t++) {
			let thisTime = timeInfo[t];

			//Create a span to hold this converted time
			let tmpTime = document.createElement("span");
			tmpTime.style.cursor = "pointer"; //Indicate that it's interactive
			tmpTime.style.borderBottom = "1px dotted currentColor"; //Modest styling that should fit in with any content
			tmpTime.textContent = thisTime[0]; //Our converted time
			//Let people mouse over the converted time to see what was actually written
			tmpTime.setAttribute("title", 'Converted to your local time from "' + thisTime[1] + '"');
			tmpTime.setAttribute("data-localised", thisTime[0]); //Used when toggling
			tmpTime.setAttribute("data-original", thisTime[1]); //Used when toggling
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
		this.textContent = this.getAttribute("data-localised");
		this.setAttribute("title", 'Converted to your local time from "' + this.getAttribute("data-original") + '"');
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
	tzaolObj["PT"] = dstAmerica ? tzaolObj["PDT"] : tzaolObj["PST"];
	tzaolObj["ET"] = dstAmerica ? tzaolObj["EDT"] : tzaolObj["EST"];
	tzaolObj["CT"] = dstAmerica ? tzaolObj["CDT"] : tzaolObj["CST"];
	tzaolObj["MT"] = dstAmerica ? tzaolObj["MDT"] : tzaolObj["MST"];
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


function spotTime(str, dateObj) {
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
	*/
	
	//let timeRegex = new RegExp('\\b([0-2]*[0-9])((:|\.)[0-5][0-9])?(?: ?([ap](?:\.?m\.?)?))?(?: ?(' + tzaolStr + '))( ?(?:\\+|-) ?[0-9]{1,2})?\\b', 'gi');
	let matches = str.matchAll(timeRegex);

	/*Groups:
		Full time string,
		Hours,
		Minutes including separator,
		Hour/minute separator,
		am/pm ,
		TimezoneAbr,
		Offset
	*/

	let timeInfo = [];
	for (const match of matches) {
		//Check that we have a match, with a valid timezone.
		if (!match[5] || typeof tzaolObj[match[5].toUpperCase()] == "undefined") { continue; }
		//We need to change the start of the regex to... maybe (^|\s)
		//The issue here is that : matches the word boundary, and if the input is "30:00 gmt" then it'll match "00 gmt"
		//if (str.substr(match.index - 1, 1) == ":") { continue; }
		if (str[0] === ":" || str[0] === ".") { continue }

		let tHour = +match[1];
		if (tHour > 23) { continue; } //Bail if we're going over a day
		if (match[4]) {
			tHour = (12 + tHour) % 12;
			if (match[4][0].toLowerCase() == 'p') {
				tHour += 12;
			}
		}
		let tMins = (match[2] ? match[2] : ':00');
		let tMinsFromMidnight = h2m(tHour + tMins, match[3]);
		let hourOffset = 0;
		//Sometimes people write a tz and then +X (like UTC+1)
		if (match[6]) {
			hourOffset = +(match[6].replace(/\s/g, '')) * 60;
		}
		let tCorrected = tMinsFromMidnight - tzaolObj[match[5].toUpperCase()] + hourOffset;
		tCorrected -= dateObj.getTimezoneOffset();

		//Build the localised time
		let tmpExplode = m2h(tCorrected).split(":");
		let tmpDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDay(), tmpExplode[0], tmpExplode[1]);
		let localeTimeString = tmpDate.toLocaleTimeString([], {hour: 'numeric', minute: 'numeric'});

		//Store the localised time, the time that we matched, its offset and length
		timeInfo.push([localeTimeString, match[0], match.index, match[0].length]);
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