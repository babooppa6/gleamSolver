// ==UserScript==
// @name Gleam.solver
// @namespace https://github.com/Citrinate/gleamSolver
// @description Autocompletes Gleam.io entries and undoes any forced social media actions
// @author Citrinate
// @version 1.1
// @match *://gleam.io/*
// @match https://steamcommunity.com/app/329630
// @updateURL https://raw.githubusercontent.com/Citrinate/gleamSolver/master/gleamSolver.user.js
// @downloadURL https://raw.githubusercontent.com/Citrinate/gleamSolver/master/gleamSolver.user.js
// @run-at document-end
// ==/UserScript==

(function() {
	var gleamSolver = (function() {
		var gleam = null;
		var waitingInterval = null;
		var steamHandler = null;

		function waitForGleam() {
			if(document.querySelector(".popup-blocks-container") !== null) {
				clearInterval(waitingInterval);
				gleam = angular.element(document.querySelector(".popup-blocks-container")).scope();
				handleEntries();
			}
		}

		function handleEntries() {
			var entries = document.querySelectorAll(".entry-method");

			for(var i = 0; i < entries.length; i++) {
				var current_entry = angular.element(entries[i]).scope();
				
				// reveal hidden entries
				current_entry.entry_method.mandatory = true;

				if(gleam.canEnter(current_entry.entry_method) && !gleam.isEntered(current_entry.entry_method)) {
					switch(current_entry.entry_method.entry_type) {
						case "steam_join_group":
							if(steamHandler === null) steamHandler = loadSteamHandler.getInstance();
							steamHandler.handleEntry(current_entry);
							break;

						case "custom_action":
						case "youtube_subscribe":
							handleClickEntry(current_entry);
							break;
							
						case "youtube_watch":
							handleYoutubeVideoEntry(current_entry);
							break;

						//TODO: handle more entry types
						default: 
							break;
					}
				}
			}
		}

		function markEntryCompleted(entry) {
			entry.entry_method.entering = false;
			entry.enterLinkClick(entry.entry_method);
			entry.verifyEntryMethod();
		}
		
		// provides visual feedback to the user that something is happening
		function markEntryLoading(entry) {
			entry.entry_method.entering = true;
		}

		function handleClickEntry(entry) {
			markEntryLoading(entry);
			entry.triggerVisit(entry.entry_method.id);
			markEntryCompleted(entry);
		}

		function handleYoutubeVideoEntry(entry) {
			markEntryLoading(entry);
			entry.entry_method.watched = true;
			entry.videoWatched(entry.entry_method);
			markEntryCompleted(entry);
		}

		// handles steam_join_group entries
		var loadSteamHandler = (function() {
			function init() {
				// Need some way to communicate with steamcommunity.com that is preferrably transparent
				// to the user.  command_hub is simply a page on steamcommunity.com that can be loaded
				// into an iframe.  We can communicate with the iframe from here and use it as our
				// interface to joining and leaving Steam groups.
				var command_hub = document.createElement('iframe');
				command_hub.style.display = "none";
				command_hub.src = "https://steamcommunity.com/app/329630";
				document.body.appendChild(command_hub);

				function handleGroup(entry, group_name, group_id) {
					// wait for the command_hub to load
					command_hub.addEventListener("load", function() {
						// make contact
						command_hub.contentWindow.postMessage({action: "join", name: group_name, id: group_id}, "*");

						// wait for a response
						window.addEventListener("message", function(event) {
							if(event.source == command_hub.contentWindow && event.data.id == group_id && event.data.status == "joined") {
								// we're in the group, mark the entry and get out of there
								markEntryCompleted(entry);
								command_hub.contentWindow.postMessage({action: "leave", name: group_name, id: group_id}, "*");
							}
						}, false);
					});
				}

				return {
					handleEntry: function(entry) {
						markEntryLoading(entry);
						handleGroup(entry, entry.entry_method.config3, entry.entry_method.config4);
					}
				};
			}

			var instance;
			return {
				getInstance: function() {
					if(!instance) instance = init();
					return instance;
				}
			};
		})();

		return {
			completeEntries: function() {
				if(gleam === null && waitingInterval === null) {
					// wait for gleam to finish loading
					waitingInterval = setInterval(waitForGleam, 500);
				} else {
					handleEntries();
				}
			}
		};
	})();

	// does the actual steam group joining/leaving
	function initCommandHub() {
		// make note of what groups we're already a member of, so that we don't leave any of them
		var active_groups = null;
		jQuery.ajax({
			url: "https://steamcommunity.com/my/groups",
			async: false,
			complete: function(data) {
				jQuery(data.responseText).find(".groupBlock a.linkTitle").each(function() {
					var group_name = jQuery(this).attr("href").replace("https://steamcommunity.com/groups/", "");
					if(active_groups === null) active_groups = [];
					active_groups.push(group_name);
				});
			}
		});

		if(active_groups !== null) {
			// wait for our parent to tell us what to do
			window.addEventListener("message", function(event) {
				if(event.source == parent && event.origin == "https://gleam.io") {
					if(event.data.action == "join") {
						joinGroup(event.data.name, event.data.id);
					} else if(event.data.action == "leave") {
						leaveGroup(event.data.name, event.data.id);
					}
				}
			}, false);
		}

		function joinGroup(group_name, group_id) {
			if(active_groups.indexOf(group_name) != -1) {
				// already a member
				parent.postMessage({status: "joined", name: group_name, id: group_id}, "*");
			} else {
				jQuery.ajax({
					url: "https://steamcommunity.com/groups/" + group_name,
					type: "POST",
					data: {action: "join", sessionID: g_sessionID},
					complete: function() {
						parent.postMessage({status: "joined", name: group_name, id: group_id}, "*");
					}
				});
			}
		}

		function leaveGroup(group_name, group_id) {
			// never leave a group that the user was already a member of
			if(active_groups.indexOf(group_name) == -1) {
				// no real need to let the gleamSolver know we left the group
				jQuery.ajax({
					url: jQuery(".playerAvatar a").attr("href").replace("http://", "https://") + "home_process",
					type: "POST",
					data: {sessionID: g_sessionID, action: "leaveGroup", groupId: group_id}
				});
			}
		}
	}

	// determine where we are and call the appropriate function
	if(document.location.hostname == "gleam.io") {
		gleamSolver.completeEntries();
	} else if(document.location.hostname == "steamcommunity.com") {
		console.log("hello");
		initCommandHub();
	}
})();