"use strict";
//I don't like duplicating this here
const tzaolObj = {"GMT":0,"EAT":180,"CET":60,"WAT":60,"CAT":120,"EET":120,"WEST":60,"WET":0,"CEST":120,"SAST":120,"HDT":-540,"HST":-600,"AKDT":-480,"AKST":-540,"AST":-240,"EST":-300,"CDT":-300,"CST":-360,"MDT":-360,"MST":-420,"PDT":-420,"PST":-480,"EDT":-240,"ADT":-180,"NST":-210,"NDT":-150,"NZST":720,"NZDT":780,"EEST":180,"HKT":480,"WIB":420,"WIT":540,"IDT":180,"IST":120,"PKT":300,"WITA":480,"KST":510,"JST":540,"ACST":570,"ACDT":630,"AEST":600,"AEDT":660,"AWST":480,"BST":60,"MSK":180,"SST":-660,"UTC":0,"PT":0,"ET":0,"MT":0,"CT":0};
let builtTZList = false;

window.onload = function() {
	document.getElementById("useSelectedTimezone").addEventListener("click", useSelectedTimezone);
	//Defer populating the tzList until we interact with it.
	document.getElementById("tzList").addEventListener("focus", buildTZList);
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
		listEntry.textContent = tz[0].padEnd(4) + " (UTC" + tzOffsetToString(tz[1]) + ")";
		listEntry.value = tz[0];
		if (tz[0] === 'UTC') { listEntry.selected = 'selected'; }
		tzListSelect.appendChild(listEntry);
	});

	builtTZList = true;
}
function tzOffsetToString(tzMins) {
	//What on earth is this ugly code
	let tzSign = tzMins < 0 ? '-' : '+';
	let h = Math.floor(Math.abs(tzMins) / 60);
	if (tzMins % 60 < 0) {  tzMins = Math.abs(tzMins); }
	if (h > 23) { h = h - 24 + ''; } else { h += ''; }
	let m = String(tzMins % 60).padStart(2, '0');
	return tzSign + h.padStart(2, '0') + ":" + m;
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
			(result) => { if (chrome.runtime.lastError || !result) { document.body.setAttribute("class", "blockedHere"); } }
		);
	}
);