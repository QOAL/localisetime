"use strict";
let builtOptionsPage = false;

let currentPage;
let previousPage;

let functionsCont;
let optionsCont;

let normalCont;
let pageTransition = false;

let functionsPage
let webpageCont;
let sandboxCont;

let optionsAbbrPage;
let sharedAbbrPage;
let ignoredAbbrPage;

//Stub the chrome object so you can load the webpage as a standalone for dev work
if (!('chrome' in window)) {
	window.chrome = {
		i18n: {
			getMessage: i=>i
		},
		tabs: {
			sendMessage: i=>i,
			query: i=>i,
			executeScript: i=>i
		},
		runtime: {
			lastError: false
		},
		storage: {
			local: {
				get: ()=>{init()},
				set: ()=>{}
			}
		},
		browserAction: {
			setIcon: ()=>{}
		}
	}
}

const defaultSettings = {
	defaults: { ...defaultTZ },
	ignored: [],
	timeFormat: 0,
	includeClock: true,
	blankSeparator: true,
	avoidMatchingFloatsManually: true,
	enabled: true
}

const optionsMap = {
	showClock: "includeClock",
	blankSeparator: "blankSeparator",
	avoidManualFloats: "avoidMatchingFloatsManually",
}

let userSettings = { ...defaultSettings }

let settingsHaveChanged = false;

window.addEventListener("DOMContentLoaded", () => {
	//Get any saved data
	chrome.storage.local.get(defaultSettings, data => {
		//Merge the default timezone selection with the user's
		//This way we can keep the list updated, should any new ones be added.
		// (Obviously doesn't handle removal)
		userSettings = { defaults: { ...defaultSettings.defaults }, ...data };
		init();
	});
});

window.addEventListener("blur", () => {
	if (!settingsHaveChanged) { return; }

	chrome.tabs.query(
		{ active: true, currentWindow: true },
		(tabs) => {
			chrome.tabs.sendMessage(
				tabs[0].id,
				{ mode: "settings" }
			);
		}
	);
});

let manualTZ = undefined;
chrome.tabs.query(
	{ active: true, currentWindow: true },
	(tabs) => {
		chrome.tabs.sendMessage(
			tabs[0].id,
			{ mode: "getManualTZ" },
			(result) => {
				manualTZ = result;
				if (typeof manualTZ === "string") {
					document.getElementById("currentManualTZCont").setAttribute("data-withTime", "")
					if (currentPage === functionsCont) {
						document.getElementById("currentManualTZ").textContent = chrome.i18n.getMessage("popupCurrentlyUsedManualConversionTime", manualTZ);
						normalCont.style.height = functionsCont.scrollHeight + "px";
					}
				}
			}
		);
	}
);

function init() {

	setEnableUI(userSettings.enabled);

	//Localise strings
	// [ElementID, StringName]
	[
		["extensionNameText", "extensionName"],

		["webpageTabText", "popupWebpageTabText"],
		["sandboxTabText", "popupSandboxTabText"],

		["manualText", "popupManualConvert"],
		["manualUsageHint", "popupManualConvertSourceText"],
		["currentManualTZ", "popupCurrentlyUsedManualConversionTime"],
		["stopManualTZ", "stop"],

		["sandboxText", "popupSandboxText"],
		["sandboxConvertTimesTo", "popupSandboxConvertTimesTo"],

		["visualsTabText", "popupVisuals"],
		["detectionTabText", "popupDetection"],
		["timezonesTabText", "popupTimezones"],
		
		["timeFormatTitle", "popupTimeFormat"],
		["timeFormatSystem", "popupTimeFormatSystem"],
		["timeFormat12", "popupTimeFormat12"],
		["timeFormat24", "popupTimeFormat24"],

		["displayOptionsTitle", "popupDisplayOptions"],

		["showClock", "popupShowClock"],

		["blankSeparatorTitle", "popupBlankSeparatorTitle"],
		["blankSeparator", "popupBlankSeparatorDescription"],

		["avoidManualFloatsTitle", "popupAvoidManualFloatsTitle"],
		["avoidManualFloats", "popupAvoidManualFloatsDescription"],

		["sharedAbbrDesc", "popupSharedAbbrDesc"],
		["ignoredAbbrDesc", "popupIgnoreAbbrDesc"],

	].forEach(i => {
		document.getElementById(i[0]).textContent = chrome.i18n.getMessage(i[1]);
	})
	document.getElementById("sandboxTextarea").placeHolder = chrome.i18n.getMessage("popupSandboxTextarea");
	document.getElementById("optionsPage").title = chrome.i18n.getMessage("popupOptions");
	document.querySelectorAll(".okText").forEach(ele => ele.textContent = chrome.i18n.getMessage("OK"));

	document.getElementById("webpageTabButton").addEventListener("click", changeTab);
	document.getElementById("sandboxTabButton").addEventListener("click", changeTab);

	document.getElementById("useSelectedTimezone").addEventListener("click", useSelectedTimezone);
	document.getElementById("stopManualTZ").addEventListener("click", clearSelectedTimezone);

	document.getElementById("sandboxConvertBtn").addEventListener("click", sandboxConvertText);

	document.getElementById("pauseExtension").addEventListener("click", enableExtension);

	document.getElementById("optionsPage").addEventListener("click", toggleOptionsPageMode);

	document.getElementById("visualsTabButton").addEventListener("click", changeTab);
	document.getElementById("detectionTabButton").addEventListener("click", changeTab);
	document.getElementById("sharedAbbrTabButton").addEventListener("click", changeTab);

	document.getElementsByName("timeFormat").forEach(tF => tF.addEventListener("change", updateTimeFormatSetting));
	document.getElementsByName("showClock")[0].addEventListener("change", updateSetting);
	document.getElementsByName("blankSeparator")[0].addEventListener("change", updateSetting);
	document.getElementsByName("avoidManualFloats")[0].addEventListener("change", updateSetting);
	document.getElementById("abbrPage").addEventListener("click", toggleAbbrPage);

	normalCont = document.getElementById("normalContent");
	functionsCont = document.getElementById("functionsMode");
	webpageCont = document.getElementById("webpageMode");
	sandboxCont = document.getElementById("sandboxMode");
	optionsCont = document.getElementById("optionsMode");
	currentPage = functionsCont;
	previousPage = optionsCont;

	sharedAbbrPage = document.getElementById("sharedAbbrPage");
	ignoredAbbrPage = document.getElementById("ignoredAbbrPage");
	optionsAbbrPage = sharedAbbrPage;
	
	buildTZList();
	buildSandboxTZList();

	normalCont.style.height = functionsCont.scrollHeight + "px";
	normalCont.style.width = functionsCont.scrollWidth + "px";
}

function updateSetting() {
	const settingName = optionsMap[this.name];

	if (!settingName) {
		console.warn("Invalid setting name", this.name);
		return;
	}

	userSettings[settingName] = this.checked;
	saveSettings();
}
function updateTimeFormatSetting() {
	userSettings.timeFormat = parseInt(this.value);
	saveSettings();
}

function saveSettings(rebuildTZList = false) {

	if (!settingsHaveChanged) {
		settingsHaveChanged = true;
	}

	chrome.storage.local.set(userSettings);

	if (rebuildTZList) {
		buildTZList();
		buildSandboxTZList();
	}
}

function buildTZList() {
	//Work out the DST dates for the USA as part
	// of special casing for DST agnostic PT/ET
	//So first we need to get those dates (We could hard code them)
	const thisYear = new Date().getUTCFullYear();
	let tmpDate = new Date(Date.UTC(thisYear, 2, 0));
	//Work out the day
	let tmpDay = (6 - tmpDate.getDay()) % 7 + 7;
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
	defaultSettings.defaults.PT = dstAmerica ? defaultTZ.PDT : defaultTZ.PST;
	defaultSettings.defaults.ET = dstAmerica ? defaultTZ.EDT : defaultTZ.EST;
	defaultSettings.defaults.CT = dstAmerica ? defaultTZ.CDT : defaultTZ.CST;
	defaultSettings.defaults.MT = dstAmerica ? defaultTZ.MDT : defaultTZ.MST;
	//

	let tzListSelect = document.getElementById("tzList");
	//tzListSelect.children[0].remove();
	let optionsFrag = document.createDocumentFragment();

	let sortedTZ = Object.entries(defaultSettings.defaults).sort((a, b) => a[1] - b[1]);

	sortedTZ.forEach(tz => {
		let listEntry = document.createElement("option");
		listEntry.textContent = tz[0]/*.padEnd(4)*/ + " (UTC" + tzOffsetToString(tz[1]) + ")";
		listEntry.value = tz[0];
		if (tz[0] === 'UTC') { listEntry.selected = 'selected'; }
		optionsFrag.appendChild(listEntry);
	});

	tzListSelect.replaceChildren(optionsFrag);
}
function buildSandboxTZList() {
	let tzListSelect = document.getElementById("tzList").cloneNode(true);

	let localOption = document.createElement("option");
	localOption.value = "local";
	localOption.textContent = chrome.i18n.getMessage("popupLocalTime");
	tzListSelect.prepend(localOption);

	document.getElementById("tzListSandbox").replaceChildren(...tzListSelect.children);

	document.getElementById("tzListSandbox").selectedIndex = 0;
}

function tzOffsetToString(tzMins) {
	const tzSign = tzMins < 0 ? '-' : '+';

	const hours = Math.floor(Math.abs(tzMins) / 60) % 24;

	if (tzMins % 60 < 0) {
		tzMins = Math.abs(tzMins);
	}

	const minutes = String(tzMins % 60).padStart(2, '0');

	return tzSign + String(hours).padStart(2, '0') + ":" + minutes;
}

function useSelectedTimezone() {
	let tzList = document.getElementById("tzList");
	let selectedTZ = tzList.options[tzList.selectedIndex].value;

	if (defaultTZ[selectedTZ] !== 'undefined') {
		chrome.tabs.query(
			{ active: true, currentWindow: true },
			(tabs) => {
				chrome.tabs.sendMessage(
					tabs[0].id,
					{ mode: "setManualTZ", selectedTZ: selectedTZ }
				);
			}
		);
	}
	window.close();
}

function clearSelectedTimezone() {
	const clearManualUI = document.getElementById("currentManualTZCont")
	if (clearManualUI.hasAttribute("data-withTime")) {
		clearManualUI.removeAttribute("data-withTime")
		normalCont.style.height = functionsCont.scrollHeight + "px";
	}

	manualTZ = undefined;

	chrome.tabs.query(
		{ active: true, currentWindow: true },
		(tabs) => {
			chrome.tabs.sendMessage(
				tabs[0].id,
				{ mode: "clearManualTZ" }
			);
		}
	);
	//window.close();
}

function enableExtension() {
	const enabled = !userSettings.enabled

	userSettings.enabled = enabled
	saveSettings()

	chrome.tabs.query({},
		(tabs) => tabs.forEach(
			tab => chrome.tabs.sendMessage(tab.id, { mode: "enabled", enabled: enabled })
		)
	)

	setEnableUI(enabled)
}
function setEnableUI(enabled) {
	const pathWord = enabled ? "icon" : "disabled"

	chrome.browserAction.setIcon({
		path: {
			16: `../icons/${pathWord}_16.png`,
			32: `../icons/${pathWord}_32.png`,
			64: `../icons/${pathWord}_64.png`,
		}
	})

	const headerEle = document.getElementById("extensionNameText").parentNode
	if (!enabled) {
		headerEle.setAttribute("data-paused", "")
		document.getElementById("animateToPlay").beginElement();
	} else {
		if (headerEle.hasAttribute("data-paused")) {
			headerEle.removeAttribute("data-paused")
		}
		document.getElementById("animateToPause").beginElement();
	}
}

function changePage(buttonEle, newPage) {
	newPage.style.display = "";

	normalCont.style.height = newPage.scrollHeight + "px";
	normalCont.style.width = newPage.scrollWidth + "px";

	newPage.classList.add("visible");
	currentPage.classList.remove("visible");
	currentPage.classList.add("goingAway");

	currentPage.addEventListener("animationend", pageChangeCallback, { once: true });

	previousPage = currentPage;
	currentPage = newPage;

	if (buttonEle) {
		buttonEle.blur();
		buttonEle.setAttribute("disabled", true);
	}

	pageTransition = true;
}

function pageChangeCallback() {
	//const previousPage = currentPage === webpageCont ? sandboxCont : webpageCont;
	previousPage.classList.remove("goingAway");
	previousPage.style.display = "none";

	if (document.getElementById("optionsPage").hasAttribute("disabled")) {
		document.getElementById("optionsPage").removeAttribute("disabled");
	}

	pageTransition = false;

	//document.getElementById("sandboxPage").removeAttribute("disabled");
}
function updateButtonText() {
	const newText = this.hasAttribute("data-newText") ? this.getAttribute("data-newText") : false;

	if (newText) {
		this.textContent = newText;
		this.classList.remove("updateText");
		this.classList.add("updateText2");
		this.removeAttribute("data-newText");
	} else {
		this.classList.remove("updateText2");
		this.removeEventListener("animationend", updateButtonText);
		this.parentNode.parentNode.removeAttribute("disabled");
	}
}

function sandboxConvertText() {
	const userText = document.getElementById("sandboxTextarea").value;
	const userTimezone = document.getElementById("tzListSandbox").value;

	if (!userText) { return; }
	if (!(defaultTZ.hasOwnProperty(userTimezone) || userTimezone === "local")) { return; }

	chrome.tabs.query(
		{ active: true, currentWindow: true },
		(tabs) => {
			chrome.tabs.sendMessage(
				tabs[0].id,
				{ mode: "sandbox", text: userText, timezone: userTimezone },
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
	newText = userText.substr(0, timeInfo[0].matchPos);
	//Go through each time we need to replace
	timeInfo.forEach((thisTime, t) => {
		newText += thisTime.localisedTime;

		//Do we have any more times to worry about?
		if (timeInfo[t + 1]) {
			//Yes
			//Insert a text node containing all the text between the end of the current time and the start of the next one
			newText += userText.substring(thisTime.matchPos + thisTime.fullStr.length, timeInfo[t + 1].matchPos);
		} else {
			//No
			//Fill in the remaining text
			newText += userText.substring(thisTime.matchPos + thisTime.fullStr.length);
		}

	})

	sandboxTextarea.value = newText;

	//We should apply an animation to the textarea now.
}

function toggleOptionsPageMode() {
	if (pageTransition) { return }
	const newPage = currentPage === optionsCont ? functionsCont : optionsCont;
	changePage(this, newPage);

	if (!builtOptionsPage) {

		const demoDate = new Date(Date.UTC(2000, 1, 1, 17, 34, 0));
		const demoTimes = [
			demoDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric' }),
			demoDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true }),
			demoDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: false })
		];
		document.getElementById("timeFormatSystem").textContent += ` (${demoTimes[0]})`;
		document.getElementById("timeFormat12").textContent += ` (${demoTimes[1]})`;
		document.getElementById("timeFormat24").textContent += ` (${demoTimes[2]})`;
		document.getElementsByName("timeFormat")[userSettings.timeFormat].checked = true;

		document.getElementsByName("showClock")[0].checked = userSettings.includeClock;

		document.getElementsByName("blankSeparator")[0].checked = userSettings.blankSeparator;

		document.getElementsByName("avoidManualFloats")[0].checked = userSettings.avoidMatchingFloatsManually;


		buildSharedAbbrList();

		buildIgnoredAbbrList();

		builtOptionsPage = true;
	}
}

function buildSharedAbbrList() {
	let frag = document.createDocumentFragment();

	Object.keys(tzInfo).forEach(abbr => {
		if (tzInfo[abbr].length < 2) { return; }

		let abbrLI = document.createElement("li");
		let tmpText = document.createElement("h5");
		tmpText.textContent = abbr;
		abbrLI.appendChild(tmpText);
		//abbrLI.appendChild(document.createTextNode(abbr));
		let abbrUL = document.createElement("ul");
		tzInfo[abbr].forEach((abbrTZ, i) => {
			const tzLI = document.createElement("li");

			const tzRadio = document.createElement("input");
			tzRadio.type = "radio";
			tzRadio.name = abbr;
			tzRadio.value = abbrTZ.offset;
			tzRadio.id = `${abbr}${abbrTZ.offset}`;
			// We're set up to make the label the selectable element via keyboard
			tzRadio.tabIndex = "-1";

			if (userSettings.defaults[abbr] === abbrTZ.offset) {
				tzRadio.setAttribute('checked', 'checked');
			}

			tzRadio.addEventListener("change", selectThisOffset);

			tzLI.appendChild(tzRadio);

			const tzLabel = document.createElement("label");
			tzLabel.setAttribute("for", `${abbr}${abbrTZ.offset}`);
			tzLabel.tabIndex = "0";
			//Need to handle enter being pressed
			tzLabel.addEventListener("keyup", selectThisOffsetFromKeyPress);

			const titleEle = document.createElement("div");
			titleEle.textContent = abbrTZ.title;
			tzLabel.appendChild(titleEle);

			const offsetEle = document.createElement("div");
			const smallUTC = document.createElement("small");
			smallUTC.textContent = "UTC";
			offsetEle.appendChild(smallUTC);
			offsetEle.appendChild(document.createTextNode(m2h(abbrTZ.offset)));
			//offsetEle.textContent = `UTC${m2h(abbrTZ.offset)}`;
			tzLabel.appendChild(offsetEle);

			//tzLI.textContent = `${abbrTZ.title} UTC${m2h(abbrTZ.offset)}`;

			tzLI.appendChild(tzLabel);

			abbrUL.appendChild(tzLI);
		})
		abbrLI.appendChild(abbrUL);
		frag.appendChild(abbrLI);
	})

	document.getElementById("userOffsetsList").replaceChildren(frag)
}
function buildIgnoredAbbrList() {
	let frag = document.createDocumentFragment();

	Object.keys(tzInfo).forEach(abbr => {

		let abbrDIV = document.createElement("div");
		abbrDIV.tabIndex = "0";
		abbrDIV.appendChild(document.createTextNode(abbr));
		abbrDIV.addEventListener("click", ignoreThisAbbr);
		if (userSettings.ignored.indexOf(abbr) !== -1) {
			abbrDIV.classList.add("ignored");
		}
		frag.appendChild(abbrDIV);

	})

	document.getElementById("userIgnoredList").replaceChildren(frag)
}

function changeTab() {
	if (this.classList.contains("currentTab")) {
		//Nothing to do
		return;
	}

	Array.from(this.parentNode.children).forEach(c => {
		if (c.classList.contains("currentTab")) {
			c.classList.remove("currentTab");
			c.classList.add("inactiveTab");

			let currentTab = document.getElementById(c.getAttribute("data-target"));
			currentTab.classList.remove("visible");
			currentTab.classList.add("goingAway");
			currentTab.addEventListener("animationend", tabChangeCallback, { once: true });

		} else if (c === this) {
			c.classList.add("currentTab");
			c.classList.remove("inactiveTab");

			let newTab = document.getElementById(c.getAttribute("data-target"));
			newTab.classList.add("visible");
		}
	})

	normalCont.style.height = currentPage.scrollHeight + "px";
	normalCont.style.width = currentPage.scrollWidth + "px";
}
function tabChangeCallback() {
	this.classList.remove('goingAway');

	normalCont.style.height = currentPage.scrollHeight + "px";
	normalCont.style.width = currentPage.scrollWidth + "px";
}

function toggleAbbrPage() {
	const sharedAbbrTitle = document.getElementById("sharedAbbrTitle");
	const newTextString = optionsAbbrPage === sharedAbbrPage ? "popupIgnoreAbbrTitle" : "popupSharedAbbrTitle";
	sharedAbbrTitle.setAttribute("data-newText", chrome.i18n.getMessage(newTextString));
	sharedAbbrTitle.addEventListener("animationend", updateButtonText);
	sharedAbbrTitle.classList.add("updateText");
	sharedAbbrTitle.parentNode.parentNode.setAttribute("disabled", true);


	optionsAbbrPage.classList.remove("visible");
	optionsAbbrPage.classList.add("goingAway");
	optionsAbbrPage.addEventListener("animationend", tabChangeCallback, { once: true });

	const nextPage = optionsAbbrPage === sharedAbbrPage ? ignoredAbbrPage : sharedAbbrPage;
	nextPage.classList.add("visible");

	optionsAbbrPage = nextPage;


	normalCont.style.height = optionsCont.scrollHeight + "px";
	normalCont.style.width = optionsCont.scrollWidth + "px";
}

function selectThisOffsetFromKeyPress(e) {
	if (e.key === "Enter") {
		const tmpEle = document.getElementById(this.getAttribute("for"))
		if (tmpEle) { tmpEle.click(); }
	}
}

function selectThisOffset() {
	//Build new defaults list, and call the save function?
	//We probably need to inform the content tab(s?) that the defaults have changed, or should we just let people manually reload?
	//We need to rebuild the tzList selection list when they change the defaults.
	//So set builtTZList to false and call buildTZList()
	//
	if (userSettings.defaults[this.name]) {
		userSettings.defaults[this.name] = parseInt(this.value);
	}

	//Save the updated list, and rebuild the tzList selection element
	saveSettings(true);
}

function ignoreThisAbbr() {
	this.blur();

	if (!userSettings.defaults[this.textContent]) { return }

	this.classList.toggle("ignored");

	const iI = userSettings.ignored.indexOf(this.textContent);

	if (iI === -1) {
		userSettings.ignored.push(this.textContent);
	} else {
		userSettings.ignored.splice(iI, 1);
	}

	//Save the updated ignored list
	saveSettings();
}

function m2h(mins) {
	const sign = mins < 0;
	mins = Math.abs(mins);
	let h = Math.floor(mins / 60) % 24;
	let m = mins % 60;
	return (sign ? '-' : '+') + String(h).padStart(2, '0') + ":" + String(m).padStart(2, '0');
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