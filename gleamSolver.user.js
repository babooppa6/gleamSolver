// ==UserScript==
// @name Gleam.solver
// @namespace https://github.com/Citrinate/gleamSolver
// @description Auto-completes Gleam.io contest entries
// @author Citrinate
// @version 1.2.1
// @match *://gleam.io/*
// @match https://steamcommunity.com/app/329630
// @updateURL https://raw.githubusercontent.com/Citrinate/gleamSolver/master/gleamSolver.user.js
// @downloadURL https://raw.githubusercontent.com/Citrinate/gleamSolver/master/gleamSolver.user.js
// @require https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js
// @run-at document-end
// ==/UserScript==

(function() {
	// command_hub_url is the only page on steamcommunity that this script will be injected at (as referenced in @match above)
	// it can be any page on steamcommunity.com that can be loaded into an iframe
	var command_hub_url = "https://steamcommunity.com/app/329630";
	var current_version = "1.2.1";

	var gleamSolver = (function() {
		var gleam = null;
		var steam_handler = null;
		var script_mode = null;
	
		// possible modes:
		// "undo_all" (Instant-win mode): There should be no record of any social media activity on the user's accounts
		// "undo_some" (Not presently used): Only when possible, remove all record of social media activity on the user's accounts
		// "undo_none (Raffle mode): All record of social media activity should remain on the user's accounts 
		function determineMode() {
			switch(gleam.campaign.campaign_type) {			
				case "Reward": return "undo_all"; // Instant-win
				case "Competition": return "undo_none";	// Raffle
				default: return "undo_all";
			}
		}
		
		function handleEntries() {
			var entries = jQuery(".entry-method");

			for(var i = 0; i < entries.length; i++) {
				var current_entry = angular.element(entries[i]).scope();

				if(gleam.canEnter(current_entry.entry_method) && !gleam.isEntered(current_entry.entry_method)) {
					//TODO: add more entry types					
					switch(current_entry.entry_method.entry_type) {
						case "steam_join_group":
							if(steam_handler === null) steam_handler = loadSteamHandler.getInstance();
							steam_handler.handleEntry(current_entry);
							break;
							
						case "youtube_subscribe":
						case "facebook_visit":
						case "twitchtv_enter":
						case "twitchtv_follow":
						case "twitter_enter":
						case "steam_enter":
						case "steam_play_game":
							handleClickEntry(current_entry);
							break;
							
						case "youtube_watch":
							handleYoutubeVideoEntry(current_entry);
							break;
						
						default: 
							break;
					}
					
					// for the following entries, it's not possible to automate them without 
					// potentially being disqualified in a gleam raffle.  only handle these if the 
					// user doesn't care about the status of the entry after this script completes:
					// such as in the case of gleam instant-win giveaways
					if(script_mode != "undo_none") {
						switch(current_entry.entry_method.entry_type) {
							case "custom_action":
								// custom_action entries can take many different forms
								switch(current_entry.entry_method.method_type) {
									case "None":
										handleClickEntry(current_entry);
										break;
									
									default:
										break;
								}
								break;
							
							default: 
								break;
						}
					}
					
					// the following entry types cannot be undone, and so only automate them
					// if the user doesn't want social media actions to be undone:
					// such as in the case of gleam raffles
					if(script_mode != "undo_all") {
						switch(current_entry.entry_method.entry_type) {
							case "twitter_follow":
							case "twitter_tweet":
							case "twitter_retweet":
							case "email_subscribe":
								handleClickEntry(current_entry);
								break;
								
							default:
								break;
						}
					}
				}
			}
		}

		function markEntryCompleted(entry, callback) {
			entry.entry_method.entering = false;
			entry.enterLinkClick(entry.entry_method);
			entry.verifyEntryMethod();
			
			// callback after gleam marks the entry as completed
			if(typeof(callback) == "function") {
				var temp_interval = setInterval(function() {
					if(gleam.isEntered(entry.entry_method)) {
						clearInterval(temp_interval);
						callback();
					}
				}, 500);
			}
		}
		
		function markEntryLoading(entry) {
			// provides visual feedback to the user that something is happening
			entry.entry_method.entering = true;
		}

		// trick gleam into thinking we've clicked a link
		function handleClickEntry(entry) {
			markEntryLoading(entry);
			entry.triggerVisit(entry.entry_method.id);
			markEntryCompleted(entry);
		}

		// trick gleam into thinking we've watched a video
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
				command_hub.src = command_hub_url;
				document.body.appendChild(command_hub);

				function handleGroup(entry, group_name, group_id) {
					// wait for the command_hub to load
					command_hub.addEventListener("load", function() {
						// make contact
						command_hub.contentWindow.postMessage({action: "join", name: group_name, id: group_id}, "*");

						// wait for a response
						window.addEventListener("message", function(event) {
							if(event.source == command_hub.contentWindow && event.data.id == group_id && event.data.status == "joined") {
								// we're in the group, mark the entry
								markEntryCompleted(entry, function() {
									if(script_mode != "undo_none") {
										// depending on user's choice of mode, leave the group
										command_hub.contentWindow.postMessage({action: "leave", name: group_name, id: group_id}, "*");
									}
								});
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
			initGleam: function() {
				// wait for gleam to finish loading
				temp_interval = setInterval(function() {
					if(jQuery(".popup-blocks-container") !== null) {
						clearInterval(temp_interval);
						gleam = angular.element(jQuery(".popup-blocks-container")).scope();
						script_mode = determineMode();
						var entries = jQuery(".entry-method");
						
						// reveal hidden entries
						for(var i = 0; i < entries.length; i++) {
							angular.element(entries[i]).scope().entry_method.mandatory = true;
						}
						
						gleamSolverUI.loadUI();
					}
				}, 500);
			},
			
			completeEntries: function() {
				handleEntries();
			}
		};
	})();

	var gleamSolverUI = (function() {
		var button_class = "btn btn-embossed btn-info";
		var button_style = { margin: "2px 0px 2px 16px" };
		var container_style = { background: "#000", padding: "8px", color: "#3498db", font: "18px Arial" };
		var gleam_solver_ui = 
			jQuery("<div>", { css: container_style }).append(
				jQuery("<span>", { text: "Gleam.solver v" + current_version })).append(
				jQuery("<a>", { text: "Click here to auto-complete", class: button_class, css: button_style}).click(function() {
					jQuery(this).unbind("click");
					gleam_solver_ui.slideUp();
					gleamSolver.completeEntries();
				})
			);
	
		return {
			loadUI: function() {				
				jQuery("html").prepend(gleam_solver_ui);
			}
		};
	})();	

	// does the actual steam group joining/leaving
	function initSteamCommandHub() {
		var active_groups = null;
		
		// make note of what groups we're already a member of, so that we don't leave any of them
		jQuery.ajax({
			url: "https://steamcommunity.com/my/groups",
			async: false,
			complete: function(data) {
				if(data.responseText.toLowerCase().indexOf("you belong to 0 groups") != -1) {
					// user isn't a member of any steam groups
					active_groups = [];
				} else {
					jQuery(data.responseText).find(".groupBlock a.linkTitle").each(function() {
						var group_name = jQuery(this).attr("href").replace("https://steamcommunity.com/groups/", "");
						if(active_groups === null) active_groups = [];
						active_groups.push(group_name);
					});
				}
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
		gleamSolver.initGleam();
	} else if(document.location == command_hub_url) {
		initSteamCommandHub();
	}
})();