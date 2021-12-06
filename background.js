chrome.storage.local.get({ enabled: true }, data => {
	userSettings = { enabled: true, ...data };

	const pathWord = userSettings.enabled ? "icon" : "disabled"

	chrome.browserAction.setIcon({
		path: {
			16: `../icons/${pathWord}_16.png`,
			32: `../icons/${pathWord}_32.png`,
			64: `../icons/${pathWord}_64.png`,
		}
	})

});