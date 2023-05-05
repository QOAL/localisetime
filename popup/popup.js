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

let manualTZ;

let currentURL;

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
	correctDSTconfusion: true,
	enabled: true,
	domainSettings: {},
}

const optionsMap = {
	showClock: "includeClock",
	blankSeparator: "blankSeparator",
	avoidManualFloats: "avoidMatchingFloatsManually",
	correctDSTconfusion: "correctDSTconfusion",
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

function init() {

	chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
		currentURL = new URL(tabs[0].url)

		const domainSettings = userSettings.domainSettings?.[currentURL.hostname]
		const pageSettings = domainSettings?.[currentURL.pathname]

		const newEnabled = ![pageSettings?.enabled, domainSettings?.enabled, userSettings.enabled].some(v => v === false)

		setEnableUI(newEnabled, true)
	})

	//setEnableUI(userSettings.enabled, true);

	//Localise strings
	// [ElementID, StringName]
	Array(
		["extensionNameText", "extensionName"],

		["pauseChoicesTitle", "popupPauseMenuTitle"],
		["pauseChoiceDomain", "popupPauseMenuDomain"],
		["pauseChoicePage", "popupPauseMenuPage"],

		["webpageTabText", "popupWebpageTabText"],
		["sandboxTabText", "popupSandboxTabText"],

		["manualText", "popupManualConvert"],
		["manualUsageHint", "popupManualConvertSourceText"],
		["rememberManualOffset", "popupManualConvertRemember"],
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

		["correctDSTconfusionTitle", "popupCorrectDSTconfusionTitle"],
		["correctDSTconfusion", "popupCorrectDSTconfusionDescription"],

		["sharedAbbrDesc", "popupSharedAbbrDesc"],
		["ignoredAbbrDesc", "popupIgnoreAbbrDesc"],

	).forEach(i => {
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

	document.getElementById("pauseChoiceDomain").addEventListener("click", pauseOnDomain);
	document.getElementById("pauseChoicePage").addEventListener("click", pauseOnPage);

	document.getElementById("pauseExtension").addEventListener("click", enableExtension);

	document.getElementById("optionsPage").addEventListener("click", toggleOptionsPageMode);

	document.getElementById("visualsTabButton").addEventListener("click", changeTab);
	document.getElementById("detectionTabButton").addEventListener("click", changeTab);
	document.getElementById("sharedAbbrTabButton").addEventListener("click", changeTab);

	document.getElementsByName("timeFormat").forEach(tF => tF.addEventListener("change", updateTimeFormatSetting));
	document.getElementsByName("showClock")[0].addEventListener("change", updateSetting);
	document.getElementsByName("blankSeparator")[0].addEventListener("change", updateSetting);
	document.getElementsByName("avoidManualFloats")[0].addEventListener("change", updateSetting);
	document.getElementsByName("correctDSTconfusion")[0].addEventListener("change", updateSetting);
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

	document.getElementById("animateToPause").addEventListener("endEvent", animateToEnd)
	document.getElementById("animateToPlay").addEventListener("endEvent", animateToEnd)
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
	const thisYear = new Date().getUTCFullYear()

	const tmpNow = Date.now()

	const offsetInfo = [
		{ hour: 0, short: "ET", standard: "EST", daylight: "EDT" },
		{ hour: 1, short: "CT", standard: "CST", daylight: "CDT" },
		{ hour: 2, short: "MT", standard: "MST", daylight: "MDT" },
		{ hour: 3, short: "PT", standard: "PST", daylight: "PDT" },
	]

	offsetInfo.forEach(info => {
		//Begin DST
		//2nd Sunday in March (2am local, 7am UTC)
		let tmpDate = new Date(Date.UTC(thisYear, 2, 0, 7 + info.hour))
		tmpDate.setUTCMonth(2, (7 - tmpDate.getUTCDay()) + 7)
		const toDST = tmpDate.getTime()

		//End of DST
		//1st Sunday in November (2am local, 6am UTC)
		tmpDate = new Date(Date.UTC(thisYear, 10, 0, 6 + info.hour))
		tmpDate.setUTCMonth(10, 7 - tmpDate.getUTCDay())
		const fromDST = tmpDate.getTime()

		const isDaylight = (tmpNow > toDST && tmpNow < fromDST)
		const usedTimeZone =  isDaylight? info.daylight : info.standard
		defaultSettings.defaults[info.short] = defaultSettings.defaults[usedTimeZone]

	})


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

function pauseOnDomain() {
	if (!currentURL) { return }

	userSettings.domainSettings[currentURL.hostname] = {
		...(userSettings.domainSettings[currentURL.hostname] || {}),
		enabled: false
	}

	pauseStuff({ url: currentURL.hostname + '/*' })
}
function pauseOnPage() {
	if (!currentURL) { return }

	userSettings.domainSettings[currentURL.hostname] = {
		...(userSettings.domainSettings[currentURL.hostname] || {}),
		[currentURL.pathname]: {
			...(userSettings.domainSettings[currentURL.hostname]?.[currentURL.pathname] || {}),
			enabled: false
		}
	}

	pauseStuff({ url: currentURL.hostname + currentURL.pathname })
}
function pauseStuff(query) {
	chrome.tabs.query({ url: currentURL.hostname + currentURL.pathname },
		(tabs) => tabs.forEach(
			tab => chrome.tabs.sendMessage(tab.id, { mode: "enabled", enabled: false })
		)
	)

	chrome.storage.local.set(userSettings)
	setEnableUI(false)
}

function enableExtension() {
	let enabled = true // !userSettings.enabled

	const domainSettings = currentURL ? userSettings.domainSettings?.[currentURL.hostname] : undefined
	const pageSettings = currentURL ? domainSettings?.[currentURL.pathname] : undefined

	const isEnabled = ![pageSettings?.enabled, domainSettings?.enabled, userSettings.enabled].some(v => v === false)

	if (isEnabled) {
		enabled = false
		userSettings.enabled = false
	} else {
		enabled = true
		if (currentURL) {
			if (pageSettings?.enabled === false) {
				pageSettings.enabled = true
			}
			if (domainSettings?.enabled === false) {
				domainSettings.enabled = true
			}
		}
		userSettings.enabled = true
	}
	saveSettings()

	chrome.tabs.query({},
		(tabs) => tabs.forEach(
			tab => chrome.tabs.sendMessage(tab.id, { mode: "enabled", enabled: enabled })
		)
	)

	setEnableUI(enabled)
}
function setEnableUI(enabled, pageLoad = false) {

	const pathWord = enabled ? "icon" : "disabled"

	chrome.browserAction.setIcon({
		path: {
			16: `../icons/${pathWord}_16.png`,
			32: `../icons/${pathWord}_32.png`,
			64: `../icons/${pathWord}_64.png`,
		}
	})

	document.getElementById("pauseChoicesMenu").classList[enabled ? "remove" : "add"]("paused")

	const pauseExtension = document.getElementById("pauseExtension")

	const headerEle = document.getElementById("extensionNameText").parentNode
	if (!enabled) {
		headerEle.setAttribute("data-paused", "")
		document.getElementById("animateToPlay").beginElement()
	} else {
		if (headerEle.hasAttribute("data-paused")) {
			headerEle.removeAttribute("data-paused")
		}
		document.getElementById("animateToPause").beginElement()
	}
	pauseExtension.classList.add("animating")
	pauseExtension.setAttribute("disabled","disabled")

	if (headerCols[0] === false) {
		const rootCSS = document.styleSheets[0].cssRules[0].style
		headerCols[0] = rootCSS.getPropertyValue('--red-rgb').split(',')
		headerCols[1] = rootCSS.getPropertyValue('--green-rgb').split(',')
	}
	headerAniDir = +enabled
	if (!pageLoad) {
		requestAnimationFrame(animateHeaderGradient)
	}

	const titleStringName = enabled ? "popupDisableExtension" : "popupEnableExtension"
	pauseExtension.title = chrome.i18n.getMessage(titleStringName)
}

function animateToEnd() {
	const pauseExtension = document.getElementById("pauseExtension")
	pauseExtension.classList.remove("animating")
	pauseExtension.removeAttribute("disabled")
}
function blendCols(col1, col2, amount) {
	return col1.map(v => 
		~~((v * (1 - amount)) + (col2 * amount))
	).join(',')
}

let headerCols = [false, false]
let startTime = 0
let headerAniDir = 0
const animationDuration = 250 //Matches the SVG animation duration. We could set that from JS, or get it instead.
function animateHeaderGradient(newTime) {
	if (startTime === 0) {
		startTime = newTime
	}
	const amount = Math.abs(headerAniDir - (Math.min(animationDuration, newTime - startTime) / animationDuration))

	if (headerAniDir === 0 ? amount < 1 : amount > 0) {
		const b1 = blendCols(headerCols[0], 82, amount)
		const b2 = blendCols(headerCols[1], 203, amount)
		document.querySelector("body > h3").style.backgroundImage = `linear-gradient(35deg, rgb(${b1}) 47.5%, rgb(${b2}) calc(47.5% + 1px))`

		requestAnimationFrame(animateHeaderGradient)
	} else {
		startTime = 0

		document.querySelector("body > h3").style.backgroundImage = ""
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

		document.getElementsByName("correctDSTconfusion")[0].checked = userSettings.correctDSTconfusion;


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

function getManualTZ(tab) {
	chrome.tabs.sendMessage(
		tab.id,
		{ mode: "getManualTZ" },
		(result) => {
			manualTZ = result;
			if (manualTZ && typeof manualTZ === "string") {
				document.getElementById("currentManualTZCont").setAttribute("data-withTime", "");
				document.getElementById("currentManualTZ").textContent = chrome.i18n.getMessage("popupCurrentlyUsedManualConversionTime", manualTZ);
				if (currentPage === functionsCont && webpageCont.classList.contains("visible")) {
					normalCont.style.height = functionsCont.scrollHeight + "px";
				}
			}
		}
	);
}

chrome.tabs.query(
	{ active: true, currentWindow: true },
	(tabs) => {
		chrome.tabs.executeScript(
			tabs[0].id,
			{ code: '1+1;' },
			(result) => {
				if (chrome.runtime.lastError || !result || (Array.isArray(result) && result[0] === undefined)) {
					document.getElementById("blockedHereContent").textContent = chrome.i18n.getMessage("popupUnableToFunction");
					document.body.setAttribute("class", "blockedHere");
				} else {
					getManualTZ(tabs[0])
				}
			}
		);
	}
);