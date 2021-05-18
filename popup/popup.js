"use strict";
//I don't like duplicating this here
const tzaolObj = {"GMT":0,"EAT":180,"CET":60,"WAT":60,"CAT":120,"EET":120,"WEST":60,"WET":0,"CEST":120,"SAST":120,"HDT":-540,"HST":-600,"AKDT":-480,"AKST":-540,"AST":-240,"EST":-300,"CDT":-300,"CST":-360,"MDT":-360,"MST":-420,"PDT":-420,"PST":-480,"EDT":-240,"ADT":-180,"NST":-210,"NDT":-150,"NZST":720,"NZDT":780,"EEST":180,"HKT":480,"WIB":420,"WIT":540,"IDT":180,"IST":120,"PKT":300,"WITA":480,"KST":540,"JST":540,"ACST":570,"ACDT":630,"AEST":600,"AEDT":660,"AWST":480,"BST":60,"MSK":180,"SST":-660,"UTC":0,"PT":0,"ET":0,"MT":0,"CT":0};
let builtTZList = false;
let builtSandboxTZList = false;

let currentPage;
let webpageCont;
let sandboxCont;
let normalCont;

window.onload = function() {
	document.getElementById("useSelectedTimezone").addEventListener("click", useSelectedTimezone);
	//Defer populating the tzList until we interact with it.
	document.getElementById("tzList").addEventListener("focus", buildTZList, { once: true });
	document.getElementById("tzList").addEventListener("mouseover", buildTZList, { once: true });
	document.getElementById("manualText").textContent = chrome.i18n.getMessage("popupManualConvert");
	document.getElementById("manualUsageHint").textContent = chrome.i18n.getMessage("popupManualConvertSourceText");
	document.querySelectorAll(".okText").forEach(ele => ele.textContent = chrome.i18n.getMessage("OK"));

	document.getElementById("sandboxPage").addEventListener("click", toggleSandboxPageMode);
	document.getElementById("sandboxText").textContent = chrome.i18n.getMessage("popupSandboxText");
	document.getElementById("sandboxPageStr").textContent = chrome.i18n.getMessage("popupSandboxMode");
	document.getElementById("sandboxTextarea").placeHolder = chrome.i18n.getMessage("popupSandboxTextarea");	
	document.getElementById("sandboxConvertTimesTo").textContent = chrome.i18n.getMessage("popupSandboxConvertTimesTo");
	document.getElementById("sandboxConvertBtn").addEventListener("click", sandboxConvertText);

	normalCont = document.getElementById("normalContent");
	webpageCont = document.getElementById("webpageMode");
	sandboxCont = document.getElementById("sandboxMode");
	currentPage = webpageCont;

	normalCont.style.height = webpageCont.scrollHeight + "px";
	normalCont.style.width = webpageCont.scrollWidth + "px";
}
function buildTZList() {
	if (builtTZList) { return; }

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

	let tzListSelect = document.getElementById("tzList");
	tzListSelect.children[0].remove();

	let sortedTZ = Object.entries(tzaolObj).sort((a, b) => a[1] - b[1]);

	sortedTZ.forEach(tz => {
		let listEntry = document.createElement("option");
		listEntry.textContent = tz[0]/*.padEnd(4)*/ + " (UTC" + tzOffsetToString(tz[1]) + ")";
		listEntry.value = tz[0];
		if (tz[0] === 'UTC') { listEntry.selected = 'selected'; }
		tzListSelect.appendChild(listEntry);
	});

	builtTZList = true;
}
function tzOffsetToString(tzMins) {
	//What on earth is this ugly code
	let tzSign = tzMins < 0 ? '-' : '+';

	let hours = Math.floor(Math.abs(tzMins) / 60);

	if (tzMins % 60 < 0) {
		tzMins = Math.abs(tzMins);
	}

	if (hours > 23) {
		hours = hours - 24 + '';
	} else {
		hours += '';
	}

	let minutes = String(tzMins % 60).padStart(2, '0');

	return tzSign + hours.padStart(2, '0') + ":" + minutes;
}

function useSelectedTimezone() {
	let tzList = document.getElementById("tzList");
	let selectedTZ = tzList.options[tzList.selectedIndex].value;
	if (tzaolObj[selectedTZ] !== 'undefined') {
		chrome.tabs.query(
			{ active: true, currentWindow: true },
			(tabs) => {
				chrome.tabs.sendMessage(
					tabs[0].id,
					{ convert: selectedTZ }
				);
			}
		);
	}
	window.close();
}

function toggleSandboxPageMode() {
	const newPage = currentPage === webpageCont ? sandboxCont : webpageCont;
	newPage.style.display = "";

	normalCont.style.height = newPage.scrollHeight + "px";
	normalCont.style.width = newPage.scrollWidth + "px";

	newPage.classList.add("visible");
	currentPage.classList.remove("visible");
	currentPage.classList.add("goingAway");

	currentPage.addEventListener("animationend", pageChangeCallback, { once: true });

	currentPage = newPage;

	if (!builtSandboxTZList) {
		buildTZList();
		let tzListSelect = document.getElementById("tzList").cloneNode(true);
		let localOption = document.createElement("option");
		localOption.value = "local";
		localOption.textContent = chrome.i18n.getMessage("popupLocalTime");
		tzListSelect.prepend(localOption);
		document.getElementById("tzListSandbox").replaceChildren(null, ...tzListSelect.children);
		document.getElementById("tzListSandbox").selectedIndex = 0;
		builtSandboxTZList = true;
	}

	const sandboxPageStr = document.getElementById("sandboxPageStr");
	const newTextString = currentPage === webpageCont ? "popupSandboxMode" : "popupWebpageMode";
	sandboxPageStr.setAttribute("data-newText", chrome.i18n.getMessage(newTextString));
	sandboxPageStr.addEventListener("animationend", updateButtonText);
	sandboxPageStr.classList.add("updateText");

	this.blur();
	this.setAttribute("disabled", true);
}
function pageChangeCallback() {
	const previousPage = currentPage === webpageCont ? sandboxCont : webpageCont;
	previousPage.classList.remove("goingAway");
	previousPage.style.display = "none";

	//document.getElementById("sandboxPage").removeAttribute("disabled");
}
function updateButtonText() {
	const sandboxPageStr = document.getElementById("sandboxPageStr");
	const newText = sandboxPageStr.hasAttribute("data-newText") ? sandboxPageStr.getAttribute("data-newText") : false;

	if (newText) {
		sandboxPageStr.textContent = newText;
		sandboxPageStr.classList.remove("updateText");
		sandboxPageStr.classList.add("updateText2");
		sandboxPageStr.removeAttribute("data-newText");
	} else {
		sandboxPageStr.classList.remove("updateText2");
		sandboxPageStr.removeEventListener("animationend", updateButtonText);
		document.getElementById("sandboxPage").removeAttribute("disabled");
	}
}
function sandboxConvertText() {
	const userText = document.getElementById("sandboxTextarea").value;
	const userTimezone = document.getElementById("tzListSandbox").value;

	if (!userText) { return; }
	if (!(tzaolObj.hasOwnProperty(userTimezone) || userTimezone === "local")) { return; }

	chrome.tabs.query(
		{ active: true, currentWindow: true },
		(tabs) => {
			chrome.tabs.sendMessage(
				tabs[0].id,
				{ sandbox: { text: userText, timezone: userTimezone } },
				sandboxProcessConvertResponse
			)
		}
	);
}
function sandboxProcessConvertResponse(timeInfo) {
	if (!timeInfo || timeInfo.length === 0) { return; }

	let sandboxTextarea = document.getElementById("sandboxTextarea")
	let userText = sandboxTextarea.value;
	let newText = "";

	//Insert any text between the start of the string and the first time occurrence
	newText = userText.substr(0, timeInfo[0][2]);
	//Go through each time we need to replace
	timeInfo.forEach((thisTime, t) => {
		newText += thisTime[0];

		//Do we have any more times to worry about?
		if (timeInfo[t + 1]) {
			//Yes
			//Insert a text node containing all the text between the end of the current time and the start of the next one
			newText += userText.substring(thisTime[2] + thisTime[3], timeInfo[t + 1][2]);
		} else {
			//No
			//Fill in the remaining text
			newText += userText.substring(thisTime[2] + thisTime[3]);
		}

	})

	sandboxTextarea.value = newText;

	//We should apply an animation to the textarea now.
}

/*
function popupMessageListener(request, sender, sendResponse) {
	//We're currently only interested in messages that tell us how many valid times (Without timezone abbreviations) are included on a page?
	if (!request.timesCount) { return }
}
chrome.runtime.onMessage.addListener(popupMessageListener);*/

chrome.tabs.query(
	{ active: true, currentWindow: true },
	(tabs) => {
		chrome.tabs.executeScript(
			tabs[0].id,
			{ code: '1+1;' },
			(result) => { if (chrome.runtime.lastError || !result || (Array.isArray(result) && result[0] === undefined)) {
				document.getElementById("blockedHereContent").textContent = chrome.i18n.getMessage("popupUnableToFunction");
				document.body.setAttribute("class", "blockedHere");
			} }
		);
	}
);