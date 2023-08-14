"use strict";

const defaultSettings = {
	enabled: true,
	domainSettings: {}
}

let userSettings = { ...defaultSettings }

let activeTab = -1

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

const manifestVersion = chrome.runtime.getManifest().manifest_version
const actionName = manifestVersion === 2 ? "browserAction" : "action"

chrome.storage.local.get(defaultSettings, data => {
	userSettings = { ...defaultSettings, ...data }

	updateIcon(userSettings.enabled)
});

chrome.tabs.onActivated.addListener(activeInfo => {
	activeTab = activeInfo.tabId

	chrome.tabs.get(activeInfo.tabId, tab => {
		updateIconByDomain(new URL(tab.url))
	})

});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (!changeInfo || !changeInfo.url) { return }

	if (activeTab === tabId) {
		updateIconByDomain(new URL(changeInfo.url))
	}
})


chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== "local") { return }

	chrome.storage.local.get(defaultSettings, data => {
		userSettings = { ...defaultSettings, ...data }
	});
})

function updateIcon(enabled) {
	chrome[actionName].setIcon(icons[+enabled])
}

function updateIconByDomain(url) {
	const domainSettings = userSettings.domainSettings?.[url.hostname]
	const pageSettings = domainSettings?.[url.pathname]

	const newEnabled = ![pageSettings?.enabled, domainSettings?.enabled, userSettings.enabled].some(v => v === false)

	updateIcon(newEnabled)
}
