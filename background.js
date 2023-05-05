"use strict";

const defaultSettings = {
	enabled: true,
	domainSettings: {}
}

let userSettings = { ...defaultSettings }

let activeTab = -1

const tabUrls = {}

const icons = [
	{
		path: {
			16: `../icons/disabled_16.png`,
			32: `../icons/disabled_32.png`,
			64: `../icons/disabled_64.png`,
		}
	},
	{
		path: {
			16: `../icons/icon_16.png`,
			32: `../icons/icon_32.png`,
			64: `../icons/icon_64.png`,
		}
	}
]

chrome.storage.local.get(defaultSettings, data => {
	userSettings = { ...defaultSettings, ...data }

	updateIcon(userSettings.enabled)

});

chrome.tabs.onActivated.addListener(function(activeInfo) {
	activeTab = activeInfo.tabId

	updateIconByDomain(activeTab)
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (!changeInfo || !changeInfo.url) { return }

	tabUrls[tabId] = new URL(changeInfo.url)

	if (activeTab === tabId) {
		updateIconByDomain(activeTab)
	}
})


chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== "local") { return }

	chrome.storage.local.get(defaultSettings, data => {
		userSettings = { ...defaultSettings, ...data }
	});
})

function updateIcon(enabled) {
	chrome.browserAction.setIcon(icons[+enabled])
}

function updateIconByDomain(tabId) {
	let newEnabled = userSettings.enabled ?? true

	let url = tabUrls[tabId]
	if (!url) {
		updateIcon(newEnabled)
		return
	}

	const domainSettings = userSettings.domainSettings?.[url.hostname]
	const pageSettings = domainSettings?.[url.pathname]

	newEnabled = ![pageSettings?.enabled, domainSettings?.enabled, userSettings.enabled].some(v => v === false)

	updateIcon(newEnabled)
}

/*
{
	"qplanner.co.uk": {
		enabled: false,
	},
	"qoal.co.uk": {
		enabled: true,
		"pies": {
			manualTZ: "pst",
		},
		"milk": {
			enabled: false,
		}
	}
}
*/
